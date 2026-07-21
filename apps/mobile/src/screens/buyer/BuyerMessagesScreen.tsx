import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useLayoutEffect, useMemo, useState } from "react";
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
import { ProfileSectionEmpty, profileScreenScrollContent } from "../../components/layout";
import { ConversationRow } from "../../components/messaging/ConversationRow";
import { ConversationSearchBar } from "../../components/messaging/ConversationSearchBar";
import { useBottomChromePad, useBottomInset } from "../../hooks/useBottomInset";
import { useChatRoomsQuery } from "../../hooks/useChatRoomsQuery";
import { useSession } from "../../context/SessionContext";
import type { ChatRoomListItem } from "../../lib/api";
import { filterChatRooms } from "../../lib/filterChatRooms";
import { chatRoomTitle } from "../../lib/messaging/chatRoomDisplay";
import { mobileSpacing, mobileFontSize } from "../../theme/mobileTheme";
import { buyerColors } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";
import { getUserFacingError } from "../../lib/userFacingError";

export function BuyerMessagesScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomChromePad = useBottomChromePad();
  const bottomInset = useBottomInset();
  const { authMe } = useSession();
  const myUserId = authMe?.user.id;
  const [search, setSearch] = useState("");
  const roomsQ = useChatRoomsQuery("buyerMessages");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatSearchUser")}
          style={{ paddingHorizontal: 8 }}
        >
          <Text style={{ color: buyerColors.primary, fontWeight: "600", fontSize: mobileFontSize.md }}>
            {t("buyer.messages.new")}
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
      headline: chatRoomTitle(room, myUserId),
      listingId: room.marketplaceListingId ?? undefined
    });
  };

  return (
    <ChatModuleGate>
      <View style={[styles.wrap, { paddingBottom: bottomChromePad }]}>
        {roomsQ.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={buyerColors.primary} />
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
                accentColor={buyerColors.primary}
              />
            }
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              profileScreenScrollContent,
              rooms.length === 0 ? styles.emptyList : undefined,
              { paddingBottom: bottomInset }
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
  error: { color: buyerColors.danger, textAlign: "center" }
});
