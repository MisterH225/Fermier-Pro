import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ChatModuleGate } from "../../components/ChatModuleGate";
import { ProfileSectionEmpty, profileScreenScrollContent } from "../../components/layout";
import { ConversationRow } from "../../components/messaging/ConversationRow";
import { ConversationSearchBar } from "../../components/messaging/ConversationSearchBar";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import {
  directConversationTitle,
  fetchChatRooms,
  type ChatRoomListItem
} from "../../lib/api";
import { filterChatRooms } from "../../lib/filterChatRooms";
import { mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

function roomTitle(room: ChatRoomListItem, myUserId?: string): string {
  if (room.kind === "direct" && myUserId) {
    return directConversationTitle(room, myUserId);
  }
  if (room.farm?.name) {
    return room.farm.name;
  }
  return room.title?.trim() || "Conversation";
}

function lastPreview(room: ChatRoomListItem): string | null {
  const last = room.messages?.[0];
  if (!last?.body) {
    return null;
  }
  const snippet =
    last.body.length > 80 ? `${last.body.slice(0, 78)}…` : last.body;
  return snippet;
}

function lastTime(room: ChatRoomListItem): string | null {
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function BuyerMessagesScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useBuyerBottomChromePad();
  const { accessToken, activeProfileId, authMe } = useSession();
  const myUserId = authMe?.user.id;
  const [search, setSearch] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatSearchUser")}
          style={{ paddingHorizontal: 8 }}
        >
          <Text style={{ color: buyerColors.primary, fontWeight: "600", fontSize: 15 }}>
            {t("buyer.messages.new")}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, t]);

  const roomsQ = useQuery({
    queryKey: ["chatRooms", activeProfileId, "buyerMessages"],
    queryFn: () => fetchChatRooms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useFocusEffect(
    useCallback(() => {
      void roomsQ.refetch();
    }, [roomsQ.refetch])
  );

  const openRoom = (room: ChatRoomListItem) => {
    navigation.navigate("ChatRoom", {
      roomId: room.id,
      headline: roomTitle(room, myUserId),
      listingId: room.marketplaceListingId ?? undefined
    });
  };

  const rooms = useMemo(
    () => filterChatRooms(roomsQ.data ?? [], search, myUserId),
    [roomsQ.data, search, myUserId]
  );

  return (
    <ChatModuleGate>
      <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
        {roomsQ.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={buyerColors.primary} />
          </View>
        ) : roomsQ.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {roomsQ.error instanceof Error
                ? roomsQ.error.message
                : String(roomsQ.error)}
            </Text>
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={
              <ConversationSearchBar
                value={search}
                onChangeText={setSearch}
                accentColor={buyerColors.primary}
              />
            }
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              profileScreenScrollContent,
              rooms.length === 0 ? styles.emptyList : undefined,
              { paddingBottom: bottomPad + mobileSpacing.lg }
            ]}
            refreshControl={
              <RefreshControl
                refreshing={roomsQ.isRefetching}
                onRefresh={() => void roomsQ.refetch()}
                tintColor={buyerColors.primary}
              />
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: mobileSpacing.sm }} />
            )}
            ListEmptyComponent={
              <ProfileSectionEmpty>{t("buyer.messages.emptySub")}</ProfileSectionEmpty>
            }
            renderItem={({ item }) => (
              <ConversationRow
                room={item}
                myUserId={myUserId}
                onPress={() => openRoom(item)}
              />
            )}
          />
        )}
      </View>
    </ChatModuleGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: buyerColors.canvas },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg
  },
  error: { color: buyerColors.danger, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    padding: mobileSpacing.md
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.pill,
    backgroundColor: buyerColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontWeight: "700", color: buyerColors.primary },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  rowTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: buyerColors.textPrimary,
    flex: 1
  },
  rowTime: { ...mobileTypography.meta, color: buyerColors.textMuted },
  rowPreview: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: 4,
    lineHeight: 18
  }
});
