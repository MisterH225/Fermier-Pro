import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MarketplaceTransactionStatus,
  ReceiptGenerationStatus,
  Prisma
} from "@prisma/client";
import { SupabaseAdminService } from "../../auth/supabase-admin.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PushNotificationsService } from "../../push-notifications/push-notifications.service";
import {
  RECEIPT_BUCKET,
  buildPriceLabel,
  categoryLabelFr,
  weightDeltaPct
} from "./receipt.format";
import { ReceiptPdfService } from "./receipt-pdf.service";
import type { ReceiptPdfInput } from "./receipt.format";

const VERIFY_BASE_URL =
  process.env.RECEIPT_VERIFY_BASE_URL?.trim() ?? "https://fermierpro.com/verify";

@Injectable()
export class ReceiptService {
  private readonly log = new Logger(ReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: ReceiptPdfService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly push: PushNotificationsService
  ) {}

  /** Génère le reçu PDF après clôture transaction (idempotent). */
  async generateReceipt(
    transactionId: string,
    options?: { force?: boolean }
  ): Promise<{ receiptNumber: string } | null> {
    const existing = await this.prisma.marketplaceTransactionReceipt.findUnique({
      where: { transactionId }
    });
    if (existing && !options?.force) {
      await this.prisma.marketplaceTransaction.updateMany({
        where: { id: transactionId },
        data: { receiptGenerationStatus: ReceiptGenerationStatus.generated }
      });
      return { receiptNumber: existing.receiptNumber };
    }

    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          include: {
            farm: true,
            animal: true
          }
        },
        offer: true,
        buyer: true,
        seller: true
      }
    });
    if (!tx || tx.status !== MarketplaceTransactionStatus.TRANSACTION_CLOSED) {
      return null;
    }

    try {
      if (existing && options?.force) {
        await this.prisma.marketplaceTransactionReceipt.delete({
          where: { id: existing.id }
        });
        if (existing.pdfStoragePath) {
          await this.supabaseAdmin.removeStorageObjects(RECEIPT_BUCKET, [
            existing.pdfStoragePath
          ]);
        }
      }

      const { receiptNumber, yearSequence, receiptYear } =
        await this.getNextReceiptNumber(new Date().getUTCFullYear());

      const pdfInput = this.buildPdfInput(tx, receiptNumber);
      const pdfBuffer = await this.pdf.renderReceiptPdf(pdfInput);
      const storagePath = `${receiptNumber}.pdf`;

      await this.uploadWithRetry(storagePath, pdfBuffer);

      await this.prisma.$transaction(async (db) => {
        await db.marketplaceTransactionReceipt.create({
          data: {
            receiptNumber,
            transactionId: tx.id,
            sellerId: tx.sellerUserId,
            buyerId: tx.buyerUserId,
            pdfStoragePath: storagePath,
            pdfSizeBytes: pdfBuffer.length,
            receiptYear,
            yearSequence
          }
        });
        await db.marketplaceTransaction.update({
          where: { id: tx.id },
          data: { receiptGenerationStatus: ReceiptGenerationStatus.generated }
        });
      });

      void this.push.sendToUser(
        tx.sellerUserId,
        "Reçu disponible",
        `Votre reçu de vente ${receiptNumber} est prêt. Téléchargez-le.`,
        { type: "marketplace_receipt_ready", transactionId: tx.id, receiptNumber }
      );
      void this.push.sendToUser(
        tx.buyerUserId,
        "Reçu disponible",
        `Votre reçu d'achat ${receiptNumber} est prêt. Téléchargez-le.`,
        { type: "marketplace_receipt_ready", transactionId: tx.id, receiptNumber }
      );

      return { receiptNumber };
    } catch (e) {
      this.log.error(
        `Receipt generation failed for ${transactionId}: ${(e as Error).message}`
      );
      await this.prisma.marketplaceTransaction.updateMany({
        where: { id: transactionId },
        data: { receiptGenerationStatus: ReceiptGenerationStatus.failed }
      });
      void this.alertSuperAdmins(transactionId);
      return null;
    }
  }

  async getReceiptForTransaction(user: User, transactionId: string) {
    const tx = await this.requireParty(transactionId, user.id);
    const receipt = await this.prisma.marketplaceTransactionReceipt.findUnique({
      where: { transactionId: tx.id }
    });
    if (!receipt) {
      const status = tx.receiptGenerationStatus;
      return {
        receiptNumber: null,
        generatedAt: null,
        downloadUrl: null,
        status
      };
    }
    const downloadUrl = await this.supabaseAdmin.createSignedStoragePathUrl(
      RECEIPT_BUCKET,
      receipt.pdfStoragePath,
      3600
    );
    if (!downloadUrl) {
      throw new NotFoundException("Impossible de générer le lien de téléchargement");
    }
    await this.markDownloaded(receipt.id, user.id, tx.sellerUserId, tx.buyerUserId);
    return {
      receiptNumber: receipt.receiptNumber,
      generatedAt: receipt.generatedAt.toISOString(),
      downloadUrl,
      status: ReceiptGenerationStatus.generated
    };
  }

  async getDownloadUrl(user: User, receiptId: string) {
    const receipt = await this.prisma.marketplaceTransactionReceipt.findUnique({
      where: { id: receiptId },
      include: { transaction: true }
    });
    if (!receipt) {
      throw new NotFoundException("Reçu introuvable");
    }
    if (
      receipt.sellerId !== user.id &&
      receipt.buyerId !== user.id
    ) {
      throw new ForbiddenException();
    }
    const downloadUrl = await this.supabaseAdmin.createSignedStoragePathUrl(
      RECEIPT_BUCKET,
      receipt.pdfStoragePath,
      3600
    );
    if (!downloadUrl) {
      throw new NotFoundException("Impossible de générer le lien de téléchargement");
    }
    await this.markDownloaded(
      receipt.id,
      user.id,
      receipt.sellerId,
      receipt.buyerId
    );
    return {
      receiptNumber: receipt.receiptNumber,
      generatedAt: receipt.generatedAt.toISOString(),
      downloadUrl
    };
  }

  async listForAdmin(filters?: {
    status?: ReceiptGenerationStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.MarketplaceTransactionWhereInput = {
      status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
    };
    if (filters?.status) {
      where.receiptGenerationStatus = filters.status;
    }
    if (filters?.from || filters?.to) {
      where.closedAt = {};
      if (filters.from) where.closedAt.gte = filters.from;
      if (filters.to) where.closedAt.lte = filters.to;
    }

    const rows = await this.prisma.marketplaceTransaction.findMany({
      where,
      orderBy: { closedAt: "desc" },
      take: 200,
      include: {
        receipt: true,
        listing: { select: { title: true } },
        seller: { select: { fullName: true } },
        buyer: { select: { fullName: true } }
      }
    });

    return rows.map((tx) => ({
      transactionId: tx.id,
      listingTitle: tx.listing.title,
      sellerName: tx.seller.fullName,
      buyerName: tx.buyer.fullName,
      closedAt: tx.closedAt?.toISOString() ?? null,
      receiptGenerationStatus: tx.receiptGenerationStatus,
      receipt: tx.receipt
        ? {
            id: tx.receipt.id,
            receiptNumber: tx.receipt.receiptNumber,
            generatedAt: tx.receipt.generatedAt.toISOString(),
            pdfSizeBytes: tx.receipt.pdfSizeBytes
          }
        : null
    }));
  }

  async adminDownload(receiptId: string) {
    const receipt = await this.prisma.marketplaceTransactionReceipt.findUnique({
      where: { id: receiptId }
    });
    if (!receipt) {
      throw new NotFoundException("Reçu introuvable");
    }
    const downloadUrl = await this.supabaseAdmin.createSignedStoragePathUrl(
      RECEIPT_BUCKET,
      receipt.pdfStoragePath,
      3600
    );
    if (!downloadUrl) {
      throw new NotFoundException("Impossible de générer le lien de téléchargement");
    }
    return {
      receiptNumber: receipt.receiptNumber,
      downloadUrl
    };
  }

  private async getNextReceiptNumber(year: number): Promise<{
    receiptNumber: string;
    yearSequence: number;
    receiptYear: number;
  }> {
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`receipt:${year}`}))`;
      const agg = await db.marketplaceTransactionReceipt.aggregate({
        where: { receiptYear: year },
        _max: { yearSequence: true }
      });
      const yearSequence = (agg._max.yearSequence ?? 0) + 1;
      const receiptNumber = `REC-${year}-${String(yearSequence).padStart(4, "0")}`;
      return { receiptNumber, yearSequence, receiptYear: year };
    });
  }

  private async uploadWithRetry(path: string, buffer: Buffer): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.supabaseAdmin.uploadStorageObject(
          RECEIPT_BUCKET,
          path,
          buffer,
          "application/pdf"
        );
        return;
      } catch (e) {
        lastError = e as Error;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    throw lastError ?? new Error("Upload reçu échoué");
  }

  private buildPdfInput(
    tx: NonNullable<
      Awaited<ReturnType<PrismaService["marketplaceTransaction"]["findUnique"]>>
    > & {
      listing: {
        title: string;
        category: import("@prisma/client").ListingMarketCategory | null;
        locationLabel: string | null;
        farm: { name: string; address: string | null } | null;
        animal: { tagCode: string | null; publicId: string } | null;
      };
      offer: { updatedAt: Date };
      buyer: { fullName: string | null; phone: string | null };
      seller: { fullName: string | null; phone: string | null };
    },
    receiptNumber: string
  ): ReceiptPdfInput {
    const realWeight =
      tx.arbitrationWeightKg?.toNumber() ??
      tx.realWeightKg?.toNumber() ??
      null;
    const estimated = tx.estimatedWeightKg?.toNumber() ?? null;
    const gross = tx.finalAmount?.toNumber() ?? Number(tx.blockedAmount);
    const commission = tx.commissionAmount?.toNumber() ?? 0;
    const sellerNet = tx.sellerReceivedAmount?.toNumber() ?? 0;
    const refund = tx.buyerRefundAmount?.toNumber() ?? 0;
    const additional = tx.buyerAdditionalCharge?.toNumber() ?? 0;
    const ratePct = Number(tx.commissionRate) * 100;

    const animalLabel =
      tx.listing.animal?.tagCode?.trim() ||
      tx.listing.title ||
      tx.listing.animal?.publicId?.slice(0, 8) ||
      "—";

    const farm = tx.listing.farm;
    const farmLocation =
      tx.listing.locationLabel?.trim() ||
      farm?.address?.trim() ||
      null;

    return {
      receiptNumber,
      transactionId: tx.id,
      issuedAt: tx.closedAt ?? new Date(),
      seller: {
        fullName: tx.seller.fullName,
        phone: tx.seller.phone,
        farmName: farm?.name ?? null,
        farmLocation
      },
      buyer: {
        fullName: tx.buyer.fullName,
        phone: tx.buyer.phone
      },
      animal: {
        label: animalLabel,
        categoryLabel: categoryLabelFr(tx.listing.category),
        estimatedWeightKg: estimated,
        realWeightKg: realWeight,
        weightDeltaPct: weightDeltaPct(estimated, realWeight)
      },
      financial: {
        priceLabel: buildPriceLabel({
          priceType: tx.priceType,
          agreedPricePerKg: tx.agreedPricePerKg?.toNumber() ?? null,
          agreedFlatPrice: tx.agreedFlatPrice?.toNumber() ?? null,
          currency: tx.currency
        }),
        realWeightKg: realWeight,
        grossAmount: gross,
        commissionRatePct: ratePct,
        commissionAmount: commission,
        sellerNetAmount: sellerNet,
        buyerPaidAmount: gross,
        buyerRefundAmount: refund,
        buyerAdditionalCharge: additional,
        currency: tx.currency
      },
      timeline: {
        offerAcceptedAt: tx.offer.updatedAt,
        paymentConfirmedAt: tx.paymentConfirmedAt,
        pickupDate: tx.pickupDate,
        weightValidatedAt: tx.weightValidatedAt,
        closedAt: tx.closedAt
      },
      verifyUrl: `${VERIFY_BASE_URL}/${receiptNumber}`
    };
  }

  private async requireParty(transactionId: string, userId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!tx) {
      throw new NotFoundException("Transaction introuvable");
    }
    if (tx.buyerUserId !== userId && tx.sellerUserId !== userId) {
      throw new ForbiddenException();
    }
    return tx;
  }

  private async markDownloaded(
    receiptId: string,
    userId: string,
    sellerId: string,
    buyerId: string
  ): Promise<void> {
    const now = new Date();
    if (userId === sellerId) {
      await this.prisma.marketplaceTransactionReceipt.update({
        where: { id: receiptId },
        data: {
          downloadedBySeller: true,
          sellerDownloadedAt: now
        }
      });
    } else if (userId === buyerId) {
      await this.prisma.marketplaceTransactionReceipt.update({
        where: { id: receiptId },
        data: {
          downloadedByBuyer: true,
          buyerDownloadedAt: now
        }
      });
    }
  }

  private async alertSuperAdmins(transactionId: string): Promise<void> {
    const admins = await this.prisma.superAdmin.findMany({
      select: { userId: true }
    });
    for (const admin of admins) {
      void this.push.sendToUser(
        admin.userId,
        "Échec génération reçu",
        `Reçu non généré pour la transaction ${transactionId.slice(0, 8)}…`,
        { type: "receipt_generation_failed", transactionId }
      );
    }
  }
}
