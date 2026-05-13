-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('producer', 'technician', 'veterinarian', 'buyer');

-- CreateEnum
CREATE TYPE "FarmLivestockMode" AS ENUM ('individual', 'batch', 'hybrid');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'manager', 'worker', 'veterinarian', 'viewer');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high');

-- CreateEnum
CREATE TYPE "HealthSeverity" AS ENUM ('info', 'watch', 'urgent');

-- CreateEnum
CREATE TYPE "VetConsultationStatus" AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "AnimalSex" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "LivestockExitKind" AS ENUM ('sale', 'mortality', 'slaughter', 'transfer');

-- CreateEnum
CREATE TYPE "PenLogType" AS ENUM ('cleaning', 'disinfection', 'mortality', 'treatment', 'other');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'published', 'reserved', 'sold', 'cancelled');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ChatRoomKind" AS ENUM ('farm', 'direct');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "email" TEXT,
    "fullName" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "producerHomeFarmName" TEXT,
    "homeLatitude" DECIMAL(10,7),
    "homeLongitude" DECIMAL(10,7),
    "homeLocationLabel" TEXT,
    "homeLocationSource" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProfileType" NOT NULL,
    "displayName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciesFocus" TEXT NOT NULL DEFAULT 'porcin',
    "livestockMode" "FarmLivestockMode" NOT NULL DEFAULT 'individual',
    "livestockCategoryPolicies" JSONB,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "address" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "farmId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmTask" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmExpense" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "label" TEXT NOT NULL,
    "category" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmRevenue" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "label" TEXT NOT NULL,
    "category" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalHealthEvent" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "severity" "HealthSeverity" NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,

    CONSTRAINT "AnimalHealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VetConsultation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "subject" TEXT NOT NULL,
    "summary" TEXT,
    "status" "VetConsultationStatus" NOT NULL DEFAULT 'open',
    "openedByUserId" TEXT NOT NULL,
    "primaryVetUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VetConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VetConsultationAttachment" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "label" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VetConsultationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breed" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "publicId" TEXT NOT NULL,
    "tagCode" TEXT,
    "sex" "AnimalSex" NOT NULL DEFAULT 'unknown',
    "birthDate" TIMESTAMP(3),
    "expectedFarrowingAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockExit" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "batchId" TEXT,
    "kind" "LivestockExitKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,
    "headcountAffected" INTEGER,
    "buyerName" TEXT,
    "price" DECIMAL(14,2),
    "currency" TEXT,
    "weightKg" DECIMAL(10,3),
    "invoiceRef" TEXT,
    "deathCause" TEXT,
    "symptoms" TEXT,
    "carcassYieldNote" TEXT,
    "slaughterDestination" TEXT,
    "transferDestination" TEXT,
    "toFarmId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivestockExit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockBatch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryKey" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "avgBirthDate" TIMESTAMP(3),
    "sourceTag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivestockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barn" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Barn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pen" (
    "id" TEXT NOT NULL,
    "barnId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "zoneLabel" TEXT,
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenPlacement" (
    "id" TEXT NOT NULL,
    "penId" TEXT NOT NULL,
    "animalId" TEXT,
    "batchId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "PenPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenLog" (
    "id" TEXT NOT NULL,
    "penId" TEXT NOT NULL,
    "type" "PenLogType" NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,

    CONSTRAINT "PenLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockBatchWeight" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "avgWeightKg" DECIMAL(10,3) NOT NULL,
    "headcountSnapshot" INTEGER,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivestockBatchWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockBatchHealthEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "severity" "HealthSeverity" NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,

    CONSTRAINT "LivestockBatchHealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "farmId" TEXT,
    "animalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DECIMAL(14,2),
    "quantity" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "locationLabel" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "pickupAt" TIMESTAMP(3),
    "pickupNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedStockLot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "remainingKg" DECIMAL(12,3) NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierName" TEXT,
    "unitPrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedStockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "offeredPrice" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalWeight" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "weightKg" DECIMAL(10,3) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmInvitation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "inviteeEmail" TEXT,
    "inviteePhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmMembership" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "kind" "ChatRoomKind" NOT NULL,
    "farmId" TEXT,
    "directKey" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_type_key" ON "Profile"("userId", "type");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_farmId_createdAt_idx" ON "AuditLog"("farmId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "FarmTask_farmId_status_idx" ON "FarmTask"("farmId", "status");

-- CreateIndex
CREATE INDEX "FarmTask_assignedUserId_idx" ON "FarmTask"("assignedUserId");

-- CreateIndex
CREATE INDEX "FarmExpense_farmId_occurredAt_idx" ON "FarmExpense"("farmId", "occurredAt");

-- CreateIndex
CREATE INDEX "FarmRevenue_farmId_occurredAt_idx" ON "FarmRevenue"("farmId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnimalHealthEvent_animalId_recordedAt_idx" ON "AnimalHealthEvent"("animalId", "recordedAt");

-- CreateIndex
CREATE INDEX "VetConsultation_farmId_status_idx" ON "VetConsultation"("farmId", "status");

-- CreateIndex
CREATE INDEX "VetConsultation_farmId_openedAt_idx" ON "VetConsultation"("farmId", "openedAt");

-- CreateIndex
CREATE INDEX "VetConsultationAttachment_consultationId_idx" ON "VetConsultationAttachment"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "Species_code_key" ON "Species"("code");

-- CreateIndex
CREATE INDEX "Breed_speciesId_idx" ON "Breed"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_speciesId_name_key" ON "Breed"("speciesId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_publicId_key" ON "Animal"("publicId");

-- CreateIndex
CREATE INDEX "Animal_farmId_idx" ON "Animal"("farmId");

-- CreateIndex
CREATE INDEX "Animal_farmId_status_idx" ON "Animal"("farmId", "status");

-- CreateIndex
CREATE INDEX "Animal_farmId_expectedFarrowingAt_idx" ON "Animal"("farmId", "expectedFarrowingAt");

-- CreateIndex
CREATE INDEX "Animal_speciesId_idx" ON "Animal"("speciesId");

-- CreateIndex
CREATE INDEX "Animal_publicId_idx" ON "Animal"("publicId");

-- CreateIndex
CREATE INDEX "LivestockExit_farmId_occurredAt_idx" ON "LivestockExit"("farmId", "occurredAt");

-- CreateIndex
CREATE INDEX "LivestockExit_farmId_kind_idx" ON "LivestockExit"("farmId", "kind");

-- CreateIndex
CREATE INDEX "LivestockExit_animalId_idx" ON "LivestockExit"("animalId");

-- CreateIndex
CREATE INDEX "LivestockExit_batchId_idx" ON "LivestockExit"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "LivestockBatch_publicId_key" ON "LivestockBatch"("publicId");

-- CreateIndex
CREATE INDEX "LivestockBatch_farmId_idx" ON "LivestockBatch"("farmId");

-- CreateIndex
CREATE INDEX "LivestockBatch_farmId_status_idx" ON "LivestockBatch"("farmId", "status");

-- CreateIndex
CREATE INDEX "LivestockBatch_publicId_idx" ON "LivestockBatch"("publicId");

-- CreateIndex
CREATE INDEX "Barn_farmId_idx" ON "Barn"("farmId");

-- CreateIndex
CREATE INDEX "Pen_barnId_idx" ON "Pen"("barnId");

-- CreateIndex
CREATE INDEX "PenPlacement_penId_endedAt_idx" ON "PenPlacement"("penId", "endedAt");

-- CreateIndex
CREATE INDEX "PenPlacement_animalId_endedAt_idx" ON "PenPlacement"("animalId", "endedAt");

-- CreateIndex
CREATE INDEX "PenPlacement_batchId_endedAt_idx" ON "PenPlacement"("batchId", "endedAt");

-- CreateIndex
CREATE INDEX "PenLog_penId_recordedAt_idx" ON "PenLog"("penId", "recordedAt");

-- CreateIndex
CREATE INDEX "LivestockBatchWeight_batchId_measuredAt_idx" ON "LivestockBatchWeight"("batchId", "measuredAt");

-- CreateIndex
CREATE INDEX "LivestockBatchHealthEvent_batchId_recordedAt_idx" ON "LivestockBatchHealthEvent"("batchId", "recordedAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerUserId_idx" ON "MarketplaceListing"("sellerUserId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_farmId_idx" ON "MarketplaceListing"("farmId");

-- CreateIndex
CREATE INDEX "FeedStockLot_farmId_purchasedAt_idx" ON "FeedStockLot"("farmId", "purchasedAt");

-- CreateIndex
CREATE INDEX "MarketplaceOffer_listingId_idx" ON "MarketplaceOffer"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceOffer_buyerUserId_idx" ON "MarketplaceOffer"("buyerUserId");

-- CreateIndex
CREATE INDEX "MarketplaceOffer_listingId_status_idx" ON "MarketplaceOffer"("listingId", "status");

-- CreateIndex
CREATE INDEX "AnimalWeight_animalId_measuredAt_idx" ON "AnimalWeight"("animalId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FarmInvitation_token_key" ON "FarmInvitation"("token");

-- CreateIndex
CREATE INDEX "FarmInvitation_farmId_idx" ON "FarmInvitation"("farmId");

-- CreateIndex
CREATE INDEX "FarmInvitation_expiresAt_idx" ON "FarmInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "FarmMembership_farmId_role_idx" ON "FarmMembership"("farmId", "role");

-- CreateIndex
CREATE INDEX "FarmMembership_userId_role_idx" ON "FarmMembership"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "FarmMembership_farmId_userId_role_key" ON "FarmMembership"("farmId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_farmId_key" ON "ChatRoom"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_directKey_key" ON "ChatRoom"("directKey");

-- CreateIndex
CREATE INDEX "ChatRoom_kind_idx" ON "ChatRoom"("kind");

-- CreateIndex
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmExpense" ADD CONSTRAINT "FarmExpense_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmExpense" ADD CONSTRAINT "FarmExpense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRevenue" ADD CONSTRAINT "FarmRevenue_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmRevenue" ADD CONSTRAINT "FarmRevenue_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthEvent" ADD CONSTRAINT "AnimalHealthEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthEvent" ADD CONSTRAINT "AnimalHealthEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetConsultation" ADD CONSTRAINT "VetConsultation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetConsultation" ADD CONSTRAINT "VetConsultation_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetConsultation" ADD CONSTRAINT "VetConsultation_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetConsultation" ADD CONSTRAINT "VetConsultation_primaryVetUserId_fkey" FOREIGN KEY ("primaryVetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetConsultationAttachment" ADD CONSTRAINT "VetConsultationAttachment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "VetConsultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetConsultationAttachment" ADD CONSTRAINT "VetConsultationAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockExit" ADD CONSTRAINT "LivestockExit_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockExit" ADD CONSTRAINT "LivestockExit_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockExit" ADD CONSTRAINT "LivestockExit_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LivestockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockExit" ADD CONSTRAINT "LivestockExit_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockExit" ADD CONSTRAINT "LivestockExit_toFarmId_fkey" FOREIGN KEY ("toFarmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barn" ADD CONSTRAINT "Barn_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pen" ADD CONSTRAINT "Pen_barnId_fkey" FOREIGN KEY ("barnId") REFERENCES "Barn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenPlacement" ADD CONSTRAINT "PenPlacement_penId_fkey" FOREIGN KEY ("penId") REFERENCES "Pen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenPlacement" ADD CONSTRAINT "PenPlacement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenPlacement" ADD CONSTRAINT "PenPlacement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LivestockBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenPlacement" ADD CONSTRAINT "PenPlacement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenLog" ADD CONSTRAINT "PenLog_penId_fkey" FOREIGN KEY ("penId") REFERENCES "Pen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenLog" ADD CONSTRAINT "PenLog_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatchWeight" ADD CONSTRAINT "LivestockBatchWeight_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LivestockBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatchHealthEvent" ADD CONSTRAINT "LivestockBatchHealthEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LivestockBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatchHealthEvent" ADD CONSTRAINT "LivestockBatchHealthEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedStockLot" ADD CONSTRAINT "FeedStockLot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedStockLot" ADD CONSTRAINT "FeedStockLot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalWeight" ADD CONSTRAINT "AnimalWeight_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInvitation" ADD CONSTRAINT "FarmInvitation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInvitation" ADD CONSTRAINT "FarmInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMembership" ADD CONSTRAINT "FarmMembership_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMembership" ADD CONSTRAINT "FarmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

