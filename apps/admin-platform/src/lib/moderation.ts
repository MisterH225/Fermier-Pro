/** @deprecated Importer depuis `@/lib/api` — réexport conservé pour compatibilité. */
export type {
  AccountStatus,
  AuditLogItem,
  ModerationScope
} from "./api";
export {
  banUser,
  deleteUserAccount,
  fetchAuditLogs,
  sendAdminMessage,
  sendBulkAdminMessage,
  suspendUser,
  unbanUser,
  unsuspendUser,
  warnUser
} from "./api";
