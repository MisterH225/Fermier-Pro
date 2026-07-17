import {
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
  MerchantOrderStatus,
  MerchantProductDisabledReason,
  MerchantProductStatus,
  type Prisma
} from "@prisma/client";
import {
  MERCHANT_ERROR,
  MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES
} from "./merchant-shop.constants";

type Tx = Prisma.TransactionClient;

const BLOCKING = new Set<string>(MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES);

/** Compte les commandes bloquantes sur les produits de la boutique. */
export async function countBlockingOrdersForShop(
  tx: Tx,
  shopId: string
): Promise<number> {
  return tx.merchantOrder.count({
    where: {
      product: { shopId },
      status: {
        in: [...BLOCKING] as MerchantOrderStatus[]
      }
    }
  });
}

/** Toute commande liée (historique) — bloque le hard delete. */
export async function countAnyOrdersForShop(
  tx: Tx,
  shopId: string
): Promise<number> {
  return tx.merchantOrder.count({
    where: { product: { shopId } }
  });
}

/**
 * Archive la boutique et dépublie tous ses produits (même transaction).
 * Ne vérifie pas les commandes — l’appelant doit avoir validé.
 */
export async function archiveShopInTransaction(
  tx: Tx,
  shopId: string,
  archivedAt: Date = new Date()
): Promise<{ productCount: number }> {
  const shop = await tx.merchantShop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new NotFoundException("Boutique introuvable");
  }
  if (shop.archivedAt) {
    throw new ConflictException({
      statusCode: 409,
      code: MERCHANT_ERROR.SHOP_ALREADY_ARCHIVED,
      message: "Cette boutique est déjà archivée"
    });
  }

  await tx.merchantShop.update({
    where: { id: shopId },
    data: { archivedAt }
  });

  const disabled = await tx.merchantProduct.updateMany({
    where: {
      shopId,
      status: {
        in: [
          MerchantProductStatus.published,
          MerchantProductStatus.draft
        ]
      }
    },
    data: {
      status: MerchantProductStatus.disabled,
      disabledAt: archivedAt,
      disabledReason: MerchantProductDisabledReason.shop_archived
    }
  });

  return { productCount: disabled.count };
}

export function shopActiveOrdersConflict(count: number): ConflictException {
  return new ConflictException({
    statusCode: 409,
    code: MERCHANT_ERROR.SHOP_HAS_ACTIVE_ORDERS,
    message:
      `Impossible d'archiver la boutique : ${count} commande(s) encore en cours ` +
      `(${MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES.join(", ")}). ` +
      `Finalisez ou résolvez-les avant.`,
    blockingStatuses: [...MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES],
    activeOrderCount: count
  });
}

export function shopOrderHistoryConflict(count: number): ConflictException {
  return new ConflictException({
    statusCode: 409,
    code: MERCHANT_ERROR.SHOP_HAS_ORDER_HISTORY,
    message:
      `Suppression définitive impossible : ${count} commande(s) liée(s) aux produits. ` +
      `Archivez la boutique à la place.`,
    orderCount: count
  });
}
