import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ChatModuleGate } from "../../components/ChatModuleGate";
import { ConversationRow } from "../../components/messaging/ConversationRow";
import { ConversationSearchBar } from "../../components/messaging/ConversationSearchBar";
import { ListSkeleton } from "../../components/common/SkeletonBlocks";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import { useChatRoomsQuery } from "../../hooks/useChatRoomsQuery";
import { useSession } from "../../context/SessionContext";
import type { ChatRoomListItem } from "../../lib/api";
import { filterChatRooms } from "../../lib/filterChatRooms";
import { chatRoomTitle } from "../../lib/messaging/chatRoomDisplay";
import { vetColors } from "../../theme/vetTheme";
import {
  mobileHeaderButtonOnDark,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { getUserFacingError } from "../../lib/userFacingError";

export function VetMessagesScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomChromePad = useBottomChromePad();
  const { authMe } = useSession();
  const myUserId = authMe?.user.id;
  const [search, setSearch] = useState("");
  const roomsQ = useChatRoomsQuery("vetMessages");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatPickFarm")}
          style={mobileHeaderButtonOnDark.btn}
        >
          <Text style={mobileHeaderButtonOnDark.text}>
            {t("vet.messages.new")}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, t]);

  const rooms = useMemo(
    () => filterChatRooms(roomsQ.data ?? [], search, myUserId),
    [roomsQ.data, search, myUserId]
  );

  const openRoom = (room: ChatRoomListItem) => {
    navigation.navigate("ChatRoom", {
      roomId: room.id,
      headline: chatRoomTitle(room, myUserId)
    });
  };

  return (
    <ChatModuleGate>
      <View style={[styles.wrap, { paddingBottom: bottomChromePad }]}>
        {roomsQ.isPending ? (
          <View style={styles.list}>
            <ListSkeleton count={6} />
          </View>
        ) : roomsQ.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {getUserFacingError(roomsQ.error, t)}
            </Text>
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={
              <ConversationSearchBar
                value={search}
                onChangeText={setSearch}
                accentColor={vetColors.primary}
              />
            }
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
            ItemSeparatorComponent={() => (
              <View style={{ height: mobileSpacing.sm }} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>{t("vet.messages.emptyTitle")}</Text>
                <Text style={styles.emptySub}>{t("vet.messages.emptySub")}</Text>
              </View>
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
  wrap: { flex: 1, backgroundColor: vetColors.canvas },
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
