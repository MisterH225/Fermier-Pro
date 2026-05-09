/** Codes d'action stables pour filtrage / exports compliance. */
export const AUDIT_ACTION = {
  animalDeleted: "animal.deleted",
  farmCreated: "farm.created",
  farmOwnershipTransferred: "farm.ownership.transferred",
  financeExpenseCreated: "finance.expense.created",
  financeExpenseUpdated: "finance.expense.updated",
  financeExpenseDeleted: "finance.expense.deleted",
  financeRevenueCreated: "finance.revenue.created",
  financeRevenueUpdated: "finance.revenue.updated",
  financeRevenueDeleted: "finance.revenue.deleted",
  healthAnimalEventCreated: "health.animal_event.created",
  healthBatchEventCreated: "health.batch_event.created",
  marketplaceOfferAccepted: "marketplace.offer.accepted",
  farmInvitationCreated: "farm.invitation.created",
  farmInvitationAccepted: "farm.invitation.accepted",
  farmMemberUpdated: "farm.member.updated",
  farmMemberRemoved: "farm.member.removed",
  vetConsultationCreated: "vet.consultation.created",
  vetConsultationUpdated: "vet.consultation.updated",
  vetConsultationAttachmentAdded: "vet.consultation.attachment_added"
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
