import { apiGetJson, apiPostJson } from "./http";

/** REST chat — aligné sur `ChatController` (`/chat/...`). */
export type ChatSenderPreview = {
  id: string;
  fullName: string | null;
  email?: string | null;
};

export type ChatMessagePreview = {
  id: string;
  body: string;
  createdAt: string;
  sender: ChatSenderPreview;
};

export type ChatRoomMemberPreview = {
  userId: string;
  user: { id: string; fullName: string | null; email?: string | null };
};

export type ChatListingSummary = {
  id: string;
  title: string;
  category: string;
  currency: string;
  pricePerKg: number | null;
  totalWeightKg: number | null;
  photoUrls: string[];
};

export type ChatRoomListItem = {
  id: string;
  kind: string;
  farmId: string | null;
  directKey: string | null;
  title: string | null;
  marketplaceListingId?: string | null;
  unreadCount?: number;
  farm?: { id: string; name: string } | null;
  marketplaceListing?: ChatListingSummary | null;
  messages?: ChatMessagePreview[];
  members?: ChatRoomMemberPreview[];
};

export type ChatMessageDto = {
  id: string;
  roomId: string;
  senderUserId: string;
  body: string;
  wasModified?: boolean;
  modificationType?: "phone_masked" | "image_blocked" | null;
  createdAt: string;
  sender: ChatSenderPreview;
};

export type ChatImageAnalysisResult = {
  allowed: boolean;
  reason?: string;
};

export function fetchChatRooms(
  accessToken: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem[]> {
  return apiGetJson<ChatRoomListItem[]>(
    "/chat/rooms",
    accessToken,
    activeProfileId
  );
}

export function ensureFarmChatRoom(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem> {
  return apiPostJson<ChatRoomListItem>(
    `/chat/rooms/farm/${farmId}`,
    {},
    accessToken,
    activeProfileId
  );
}

export function ensureDirectChatRoom(
  accessToken: string,
  peerUserId: string,
  activeProfileId?: string | null,
  marketplaceListingId?: string | null,
  merchantProductId?: string | null
): Promise<ChatRoomListItem> {
  return apiPostJson<ChatRoomListItem>(
    "/chat/rooms/direct",
    {
      peerUserId,
      ...(marketplaceListingId ? { marketplaceListingId } : {}),
      ...(merchantProductId ? { merchantProductId } : {})
    },
    accessToken,
    activeProfileId
  );
}

export function fetchChatRoom(
  accessToken: string,
  roomId: string,
  activeProfileId?: string | null
): Promise<ChatRoomListItem> {
  return apiGetJson<ChatRoomListItem>(
    `/chat/rooms/${roomId}`,
    accessToken,
    activeProfileId
  );
}

export function markChatRoomRead(
  accessToken: string,
  roomId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiPostJson<{ ok: true }>(
    `/chat/rooms/${roomId}/read`,
    {},
    accessToken,
    activeProfileId
  );
}
/** Titre d’une conversation directe à partir du salon renvoyé par l’API. */
export function directConversationTitle(
  room: ChatRoomListItem,
  myUserId: string
): string {
  const other = room.members?.find((m) => m.userId !== myUserId);
  return other?.user?.fullName?.trim() || "Message direct";
}

export type UserSearchResultDto = {
  id: string;
  fullName: string | null;
  email: string | null;
};

/** GET /chat/directory/users — recherche pour DM (q ≥ 2, utilisateurs partageant une ferme avec toi). */
export function searchUsersForChat(
  accessToken: string,
  query: string,
  activeProfileId?: string | null
): Promise<UserSearchResultDto[]> {
  const qs = new URLSearchParams({ q: query.trim() });
  return apiGetJson<UserSearchResultDto[]>(
    `/chat/directory/users?${qs.toString()}`,
    accessToken,
    activeProfileId
  );
}

export function fetchChatMessages(
  accessToken: string,
  roomId: string,
  activeProfileId?: string | null,
  opts?: { cursor?: string; take?: number }
): Promise<ChatMessageDto[]> {
  const qs = new URLSearchParams();
  if (opts?.cursor) qs.set("cursor", opts.cursor);
  if (opts?.take != null) qs.set("take", String(opts.take));
  const q = qs.toString();
  return apiGetJson<ChatMessageDto[]>(
    `/chat/rooms/${roomId}/messages${q ? `?${q}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export function postChatMessage(
  accessToken: string,
  roomId: string,
  body: string,
  activeProfileId?: string | null
): Promise<ChatMessageDto> {
  return apiPostJson<ChatMessageDto>(
    `/chat/rooms/${roomId}/messages`,
    { body },
    accessToken,
    activeProfileId
  );
}

export function analyzeChatImage(
  accessToken: string,
  imageBase64: string,
  mimeType: string,
  activeProfileId?: string | null
): Promise<ChatImageAnalysisResult> {
  return apiPostJson<ChatImageAnalysisResult>(
    "/chat/analyze-image",
    { imageBase64, mimeType },
    accessToken,
    activeProfileId
  );
}
