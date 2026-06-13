-- Renomme le statut cheptel `reformed` → `exited` (sortie du cheptel).
UPDATE "Animal"
SET status = 'exited'
WHERE status = 'reformed';

UPDATE "LivestockStatusLog"
SET "oldStatus" = 'exited'
WHERE "oldStatus" = 'reformed';

UPDATE "LivestockStatusLog"
SET "newStatus" = 'exited'
WHERE "newStatus" = 'reformed';
