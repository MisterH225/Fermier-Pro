import type { Prisma, PrismaClient } from "@prisma/client";

/** Modèles Prisma du catalogue commerçant protégés. */
export const MERCHANT_CATALOG_MODELS = new Set([
  "MerchantShop",
  "MerchantProduct"
]);

/**
 * Autorise les DELETE SQL sur MerchantShop / MerchantProduct pour la transaction
 * courante uniquement (set_config is_local=true).
 */
export async function allowMerchantCatalogHardDelete(
  client: Prisma.TransactionClient | PrismaClient
): Promise<void> {
  await client.$executeRawUnsafe(
    `SELECT set_config('fermier.allow_merchant_catalog_delete', '1', true)`
  );
}

function isEmptyWhere(where: unknown): boolean {
  if (where == null) {
    return true;
  }
  if (typeof where !== "object") {
    return false;
  }
  return Object.keys(where as Record<string, unknown>).length === 0;
}

/**
 * Middleware Prisma : refuse deleteMany sans filtre sur le catalogue commerçant.
 * La protection DB (trigger) reste la source de vérité ; ceci bloque tôt côté app.
 */
export function installMerchantCatalogDeleteGuard(
  client: PrismaClient
): void {
  client.$use(async (params, next) => {
    if (
      params.action === "deleteMany" &&
      params.model &&
      MERCHANT_CATALOG_MODELS.has(params.model)
    ) {
      if (isEmptyWhere(params.args?.where)) {
        throw new Error(
          `[merchant-catalog-guard] deleteMany(${params.model}) sans filtre refusé. ` +
            `Scoper explicitement (ex. userId e2e) et appeler allowMerchantCatalogHardDelete().`
        );
      }
    }
    return next(params);
  });
}

/**
 * Exécute `fn` dans une transaction Prisma avec autorisation de hard-delete catalogue.
 */
export async function withMerchantCatalogHardDelete<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await allowMerchantCatalogHardDelete(tx);
    return fn(tx);
  });
}
