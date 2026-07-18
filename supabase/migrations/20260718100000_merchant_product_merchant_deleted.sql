-- Soft-delete raison pour produits commerçants (aligné Prisma)
ALTER TYPE "MerchantProductDisabledReason" ADD VALUE IF NOT EXISTS 'merchant_deleted';
