-- AlterEnum (idempotent: valeur peut déjà exister si appliquée manuellement sur Supabase)
ALTER TYPE "MarketplaceTransactionStatus" ADD VALUE IF NOT EXISTS 'PICKUP_PROPOSED';
