import type { ChatRoomListItem } from "./api";
import { directConversationTitle } from "./api";
import { formatPrivacyDisplayName } from "./userDisplay";

function roomSearchTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.kind === "direct" && myUserId) {
    const peer = room.members?.find((m) => m.userId !== myUserId)?.user;
    if (peer?.fullName) {
      return formatPrivacyDisplayName(peer.fullName);
    }
    return directConversationTitle(room, myUserId);
  }
  return room.farm?.name?.trim() || room.title?.trim() || "";
}

export function filterChatRooms(
  rooms: ChatRoomListItem[],
  query: string,
  myUserId?: string
): ChatRoomListItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return rooms;
  }
  return rooms.filter((room) => {
    const haystack = [
      roomSearchTitle(room, myUserId),
      room.marketplaceListing?.title ?? "",
      room.messages?.[0]?.body ?? ""
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
