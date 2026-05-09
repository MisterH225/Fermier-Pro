/** Codes d'action stables pour filtrage / exports compliance. */
export const AUDIT_ACTION = {
  animalDeleted: "animal.deleted",
  farmCreated: "farm.created",
  financeExpenseCreated: "finance.expense.created",
  financeRevenueCreated: "finance.revenue.created",
  healthAnimalEventCreated: "health.animal_event.created",
  healthBatchEventCreated: "health.batch_event.created",
  marketplaceOfferAccepted: "marketplace.offer.accepted",
  farmInvitationCreated: "farm.invitation.created",
  farmInvitationAccepted: "farm.invitation.accepted",
  vetConsultationCreated: "vet.consultation.created",
  vetConsultationUpdated: "vet.consultation.updated",
  vetConsultationAttachmentAdded: "vet.consultation.attachment_added"
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
