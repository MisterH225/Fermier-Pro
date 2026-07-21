-- Corriger les offres en statut 'accepted' dont la transaction est annulée.
-- Ces cas existent car le fix PR #110 n'était pas encore en place quand ces
-- transactions ont été annulées.
DO $$ BEGIN
  UPDATE "MarketplaceOffer" o
SET status = 'cancelled'
FROM "MarketplaceTransaction" t
WHERE t."offerId" = o.id
  AND o.status = 'accepted'
  AND t.status IN (
    'CANCELLED_BY_BUYER',
    'CANCELLED_BY_SELLER',
    'CANCELLED_SOLD_TO_OTHER',
    'PAYMENT_FAILED'
  );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;