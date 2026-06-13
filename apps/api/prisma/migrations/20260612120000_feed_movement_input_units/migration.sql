-- Persiste l'unité de saisie des entrées stock (correction sacs/kg depuis Finance).
ALTER TABLE "FeedStockMovement"
  ADD COLUMN "quantityInput" DECIMAL(14, 4),
  ADD COLUMN "quantityUnit" "FeedTypeUnit",
  ADD COLUMN "priceBasis" TEXT;
