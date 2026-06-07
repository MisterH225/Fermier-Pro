export const FARM_INVITATION_MESSAGE_TYPE = "farm_invitation" as const;

export type FarmInvitationChatPayload = {
  _type: typeof FARM_INVITATION_MESSAGE_TYPE;
  invitationId: string;
  farmId: string;
  farmName: string;
  recipientKind: string;
  roleLabel: string;
  status: "pending" | "accepted" | "rejected";
};

export function buildFarmInvitationMessageBody(
  payload: FarmInvitationChatPayload
): string {
  return JSON.stringify(payload);
}

export function parseFarmInvitationMessageBody(
  body: string
): FarmInvitationChatPayload | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<FarmInvitationChatPayload>;
    if (parsed._type !== FARM_INVITATION_MESSAGE_TYPE || !parsed.invitationId) {
      return null;
    }
    return parsed as FarmInvitationChatPayload;
  } catch {
    return null;
  }
}
