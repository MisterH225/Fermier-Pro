import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { FarmMarketplaceLifecycleService } from "../marketplace/farm-marketplace-lifecycle.service";

@Injectable()
export class FarmDataPurgeService {
  constructor(
    private readonly marketplaceLifecycle: FarmMarketplaceLifecycleService
  ) {}

  /**
   * Purge complète d'une ferme dans une transaction existante (sans supprimer la ferme).
   */
  async purgeFarmWithinTransaction(
    tx: Prisma.TransactionClient,
    farmId: string
  ): Promise<
    Awaited<ReturnType<FarmMarketplaceLifecycleService["applyFarmDeleted"]>>["notices"]
  > {
    const del = await this.marketplaceLifecycle.applyFarmDeleted(tx, farmId);
    await this.marketplaceLifecycle.purgeListingsAfterFarmDelete(
      tx,
      del.listingIds
    );
    await this.purgeFarmData(tx, farmId);
    return del.notices;
  }

  /** Marketplace restant lié à l'utilisateur (hors fermes déjà purgées). */
  async purgeUserMarketplaceData(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    const sellerListings = await tx.marketplaceListing.findMany({
      where: { sellerUserId: userId },
      select: { id: true }
    });
    const sellerListingIds = sellerListings.map((l) => l.id);
    if (sellerListingIds.length > 0) {
      await this.marketplaceLifecycle.purgeListingsAfterFarmDelete(
        tx,
        sellerListingIds
      );
    }

    const transactions = await tx.marketplaceTransaction.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      select: { id: true }
    });
    const transactionIds = transactions.map((t) => t.id);
    if (transactionIds.length > 0) {
      await tx.platformRevenue.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceDeliveryDispute.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceFundMovement.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplacePendingTransfer.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceTransactionReceipt.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      await tx.marketplaceTransaction.deleteMany({
        where: { id: { in: transactionIds } }
      });
    }

    await tx.marketplaceCreditArbitration.deleteMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] }
    });
    await tx.marketplaceDeliveryDispute.deleteMany({
      where: { raisedByUserId: userId }
    });
    await tx.marketplacePendingTransfer.deleteMany({
      where: { buyerUserId: userId }
    });
    await tx.marketplaceOffer.deleteMany({ where: { buyerUserId: userId } });
    await tx.marketplaceListing.deleteMany({ where: { sellerUserId: userId } });
  }

  dispatchBuyerNotices(
    notices: Awaited<
      ReturnType<FarmMarketplaceLifecycleService["applyFarmDeleted"]>
    >["notices"]
  ): void {
    this.marketplaceLifecycle.dispatchBuyerNotices(notices);
  }

  async purgeFarmData(
    tx: Prisma.TransactionClient,
    farmId: string
  ): Promise<void> {
    await tx.user.updateMany({
      where: { activeFarmId: farmId },
      data: { activeFarmId: null }
    });

    await tx.marketplacePendingTransfer.deleteMany({
      where: { buyerFarmId: farmId }
    });

    const vetAppointments = await tx.vetAppointment.findMany({
      where: { farmId },
      select: { id: true }
    });
    const vetAppointmentIds = vetAppointments.map((a) => a.id);
    if (vetAppointmentIds.length > 0) {
      await tx.platformRevenue.deleteMany({
        where: { vetAppointmentId: { in: vetAppointmentIds } }
      });
      await tx.vetAppointmentFundMovement.deleteMany({
        where: { appointmentId: { in: vetAppointmentIds } }
      });
      await tx.vetAppointmentRating.deleteMany({
        where: { appointmentId: { in: vetAppointmentIds } }
      });
    }
    await tx.vetAppointment.deleteMany({ where: { farmId } });

    await tx.batchProfitabilitySnapshot.deleteMany({ where: { farmId } });
    await tx.farmProfitabilitySnapshot.deleteMany({ where: { farmId } });
    await tx.farmPrediction.deleteMany({ where: { farmId } });

    await tx.pigPriceSnapshot.updateMany({
      where: { farmId },
      data: { farmId: null }
    });
    await tx.chatSecurityEvent.updateMany({
      where: { farmId },
      data: { farmId: null }
    });

    await tx.farmBudgetLine.deleteMany({
      where: { budget: { farmId } }
    });
    await tx.farmBudgetSuggestion.deleteMany({ where: { farmId } });
    await tx.farmBudget.deleteMany({ where: { farmId } });

    await tx.litter.deleteMany({ where: { farmId } });
    await tx.gestationVaccine.deleteMany({
      where: { gestation: { farmId } }
    });
    await tx.gestationChecklistItem.deleteMany({
      where: { gestation: { farmId } }
    });
    await tx.gestation.deleteMany({ where: { farmId } });

    await tx.healthMortalityDetail.deleteMany({
      where: { healthRecord: { farmId } }
    });
    await tx.healthTreatmentDetail.deleteMany({
      where: { healthRecord: { farmId } }
    });
    await tx.healthVetVisitDetail.deleteMany({
      where: { healthRecord: { farmId } }
    });
    await tx.healthDiseaseDetail.deleteMany({
      where: { healthRecord: { farmId } }
    });
    await tx.healthVaccinationDetail.deleteMany({
      where: { healthRecord: { farmId } }
    });
    await tx.vaccineRecord.deleteMany({ where: { farmId } });
    await tx.farmHealthRecord.deleteMany({ where: { farmId } });

    await tx.livestockBatchHealthEvent.deleteMany({
      where: { batch: { farmId } }
    });
    await tx.livestockBatchWeight.deleteMany({
      where: { batch: { farmId } }
    });

    await tx.livestockExit.deleteMany({
      where: { OR: [{ farmId }, { toFarmId: farmId }] }
    });

    await tx.penLog.deleteMany({ where: { pen: { barn: { farmId } } } });
    await tx.penPlacement.deleteMany({ where: { pen: { barn: { farmId } } } });
    await tx.pen.deleteMany({ where: { barn: { farmId } } });
    await tx.barn.deleteMany({ where: { farmId } });

    await tx.livestockBatch.deleteMany({ where: { farmId } });

    await tx.animalWeight.deleteMany({ where: { animal: { farmId } } });
    await tx.taskNotification.deleteMany({ where: { task: { farmId } } });
    await tx.farmTask.deleteMany({ where: { farmId } });

    await tx.vetConsultationAttachment.deleteMany({
      where: { consultation: { farmId } }
    });
    await tx.vetConsultation.deleteMany({ where: { farmId } });

    await tx.animal.deleteMany({ where: { farmId } });

    await tx.feedReconciliationRejection.deleteMany({ where: { farmId } });
    await tx.feedStockMovement.deleteMany({ where: { farmId } });
    await tx.feedType.deleteMany({ where: { farmId } });

    await tx.standardVaccine.deleteMany({ where: { farmId } });

    await tx.memberActivityLog.deleteMany({ where: { farmId } });
    await tx.farmMembership.deleteMany({ where: { farmId } });
    await tx.farmInvitation.deleteMany({ where: { farmId } });
    await tx.farmMarketRating.deleteMany({ where: { farmId } });

    await tx.chatMessage.deleteMany({ where: { room: { farmId } } });
    await tx.chatRoomMember.deleteMany({ where: { room: { farmId } } });
    await tx.chatRoom.deleteMany({ where: { farmId } });

    await tx.vetRating.deleteMany({ where: { ratedByFarmId: farmId } });

    await tx.smartAlert.deleteMany({ where: { farmId } });
    await tx.farmAlertSettings.deleteMany({ where: { farmId } });

    await tx.farmReport.deleteMany({ where: { farmId } });

    await tx.farmExpense.deleteMany({ where: { farmId } });
    await tx.farmRevenue.deleteMany({ where: { farmId } });
    await tx.financeCategory.deleteMany({ where: { farmId } });
    await tx.farmFinanceSettings.deleteMany({ where: { farmId } });

    await tx.farmGmqSettings.deleteMany({ where: { farmId } });
    await tx.gestationSettings.deleteMany({ where: { farmId } });
    await tx.farmProfitabilitySettings.deleteMany({ where: { farmId } });
    await tx.farmAppSettings.deleteMany({ where: { farmId } });

    await tx.livestockStatusLog.deleteMany({ where: { farmId } });
    await tx.auditLog.deleteMany({ where: { farmId } });
  }
}
