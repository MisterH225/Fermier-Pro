import type { ChatRoomListItem } from "../api";
import { directConversationTitle } from "../api";
import {
  formatOfferPreview,
  parseMarketplaceOfferMessage
} from "../marketplaceOfferMessage";
import { formatPrivacyDisplayName } from "../userDisplay";

/** Titre affiché pour une conversation (navigation + liste). */
export function chatRoomTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.kind === "direct" && myUserId) {
    const peer = room.members?.find((m) => m.userId !== myUserId)?.user;
    if (peer?.fullName) {
      return formatPrivacyDisplayName(peer.fullName);
    }
    return directConversationTitle(room, myUserId);
  }
  if (room.farm?.name) {
    return room.farm.name;
  }
  return room.title?.trim() || "Conversation";
}

export function chatRoomLastPreview(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.body?.trim()) {
    return null;
  }
  const body = last.body.trim();
  const offer = parseMarketplaceOfferMessage(body);
  const text = offer ? formatOfferPreview(offer) : body;
  return text.length > 80 ? `${text.slice(0, 78)}…` : text;
}

export function chatRoomLastTime(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.createdAt) {
    return null;
  }
  const d = new Date(last.createdAt);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString(undefined, {
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short" })
  });
}

export function chatRoomInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function chatRoomListingPill(
  room: ChatRoomListItem,
  contextPill?: string | null
): string | null {
  if (contextPill) {
    return contextPill;
  }
  const title = room.marketplaceListing?.title?.trim();
  return title ? `Annonce · ${title}` : null;
}
