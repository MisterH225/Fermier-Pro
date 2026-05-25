import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ChatModuleGate } from "../../components/ChatModuleGate";
import { ConversationItem } from "../../components/vet/ConversationItem";
import { useVetBottomChromePad } from "../../context/VetBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import {
  directConversationTitle,
  fetchChatRooms,
  type ChatRoomListItem
} from "../../lib/api";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

function roomHeadline(room: ChatRoomListItem, myUserId?: string): string {
  if (room.farm?.name) {
    return room.farm.name;
  }
  if (room.kind === "direct" && myUserId) {
    return directConversationTitle(room, myUserId);
  }
  return room.title?.trim() || "Conversation";
}

export function VetMessagesScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useVetBottomChromePad();
  const { accessToken, activeProfileId, authMe } = useSession();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatPickFarm")}
          style={{ paddingHorizontal: 8 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            {t("vet.messages.new")}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, t]);

  const roomsQ = useQuery({
    queryKey: ["chatRooms", activeProfileId, "vetMessages"],
    queryFn: () => fetchChatRooms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useFocusEffect(
    useCallback(() => {
      void roomsQ.refetch();
    }, [roomsQ.refetch])
  );

  const rooms = roomsQ.data ?? [];
  const myUserId = authMe?.user.id;

  const openRoom = (room: ChatRoomListItem) => {
    navigation.navigate("ChatRoom", {
      roomId: room.id,
      headline: roomHeadline(room, myUserId)
    });
  };

  return (
    <ChatModuleGate>
      <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
        {roomsQ.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={vetColors.primary} />
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
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              rooms.length === 0 ? styles.emptyList : styles.list
            }
            refreshControl={
              <RefreshControl
                refreshing={roomsQ.isRefetching}
                onRefresh={() => void roomsQ.refetch()}
                tintColor={vetColors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: mobileSpacing.sm }} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>{t("vet.messages.emptyTitle")}</Text>
                <Text style={styles.emptySub}>{t("vet.messages.emptySub")}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <ConversationItem
                room={item}
                myUserId={myUserId}
                onPress={() => openRoom(item)}
                onMessage={() => openRoom(item)}
                onCall={() => openRoom(item)}
              />
            )}
          />
        )}
      </View>
    </ChatModuleGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: vetColors.background },
  list: { padding: mobileSpacing.lg, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  error: { color: vetColors.danger, textAlign: "center" },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    paddingTop: 48
  },
  emptyTitle: {
    ...mobileTypography.title,
    fontSize: 18,
    color: vetColors.textPrimary,
    marginBottom: 10
  },
  emptySub: {
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    lineHeight: 22
  }
});
