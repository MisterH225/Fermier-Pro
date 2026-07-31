-- AlterTable SavedComposition : cache explication structurée (IA / fallback)
ALTER TABLE "SavedComposition" ADD COLUMN "explanation" JSONB;
