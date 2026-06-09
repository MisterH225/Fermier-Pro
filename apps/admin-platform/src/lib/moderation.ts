import { apiFetch } from "./api";

export type ModerationScope =
  | "account"
  | "veterinarian"
  | "producer"
  | "technician"
  | "buyer";

export type AccountStatus = "active" | "suspended" | "banned";

export async function suspendUser(
  token: string,
  userId: string,
  body: {
    scope: ModerationScope;
    reason: string;
    details?: string;
    duration: string;
    notifyUser?: boolean;
  }
) {
  return apiFetch(`/admin/users/${userId}/suspend`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function unsuspendUser(
  token: string,
  userId: string,
  body: { scope: ModerationScope; note?: string; notifyUser?: boolean }
) {
  return apiFetch(`/admin/users/${userId}/unsuspend`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function banUser(
  token: string,
  userId: string,
  body: {
    scope: ModerationScope;
    reason: string;
    details: string;
    notifyUser?: boolean;
  }
) {
  return apiFetch(`/admin/users/${userId}/ban`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function warnUser(
  token: string,
  userId: string,
  body: {
    motive: string;
    message: string;
    warningLevel: string;
    notifyUser?: boolean;
  }
) {
  return apiFetch(`/admin/users/${userId}/warn`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function sendAdminMessage(
  token: string,
  body: {
    userId: string;
    subject: string;
    type: "notification" | "warning" | "info";
    message: string;
    sendPush?: boolean;
  }
) {
  return apiFetch(`/admin/messages`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function deleteUserAccount(
  token: string,
  userId: string,
  body: { reason: string; notifyUser?: boolean }
) {
  return apiFetch(`/admin/users/${userId}/account`, token, {
    method: "DELETE",
    body: JSON.stringify(body)
  });
}

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  targetProfileType: string;
  targetProfileId: string | null;
  reason: string | null;
  admin: { id: string; fullName: string | null; email: string | null };
  target: { id: string; fullName: string | null; email: string | null };
};

export async function fetchAuditLogs(
  token: string,
  params: { userId?: string; skip?: number; take?: number }
) {
  const q = new URLSearchParams();
  if (params.userId) q.set("userId", params.userId);
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.take != null) q.set("take", String(params.take));
  return apiFetch<{ total: number; items: AuditLogItem[] }>(
    `/admin/audit-logs?${q}`,
    token
  );
}

