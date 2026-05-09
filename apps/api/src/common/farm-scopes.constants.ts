/** Scopes stockes sur `FarmMembership.scopes` (invitations, RBAC). */
export const FARM_SCOPE = {
  ALL: "*",
  financeRead: "finance.read",
  financeWrite: "finance.write",
  tasksRead: "tasks.read",
  tasksWrite: "tasks.write",
  livestockRead: "livestock.read",
  livestockWrite: "livestock.write",
  healthRead: "health.read",
  healthWrite: "health.write",
  housingRead: "housing.read",
  housingWrite: "housing.write",
  exitsRead: "exits.read",
  exitsWrite: "exits.write",
  vetRead: "vet.read",
  vetWrite: "vet.write",
  invitationsManage: "invitations.manage",
  chat: "chat",
  marketplaceRead: "marketplace.read",
  marketplaceWrite: "marketplace.write",
  auditRead: "audit.read"
} as const;
