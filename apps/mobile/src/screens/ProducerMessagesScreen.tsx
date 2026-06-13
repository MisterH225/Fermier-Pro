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
import { MobileAppShell } from "../components/layout";
import { ConversationRow } from "../components/messaging/ConversationRow";
import { ConversationSearchBar } from "../components/messaging/ConversationSearchBar";
import { useBottomChromePad } from "../hooks/useBottomInset";
import { useChatRoomsQuery } from "../hooks/useChatRoomsQuery";
import { useSession } from "../context/SessionContext";
import type { ChatRoomListItem } from "../lib/api";
import { filterChatRooms } from "../lib/filterChatRooms";
import { chatRoomTitle } from "../lib/messaging/chatRoomDisplay";
import {
  mobileColors,
  mobileHeaderButtonOnDark,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { getUserFacingError } from "../lib/userFacingError";

export function ProducerMessagesScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useBottomChromePad();
  const { activeProfileId, authMe } = useSession();
  const myUserId = authMe?.user.id;
  const [search, setSearch] = useState("");
  const roomsQ = useChatRoomsQuery("producerMessages");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatSearchUser")}
          style={mobileHeaderButtonOnDark.btn}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={mobileHeaderButtonOnDark.text}>
            {t("producer.messages.new")}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, t]);

  const rooms = useMemo(
    () => filterChatRooms(roomsQ.data ?? [], search, myUserId),
    [roomsQ.data, search, myUserId]
  );

  const openRoom = (item: ChatRoomListItem) => {
    navigation.navigate("ChatRoom", {
      roomId: item.id,
      headline: chatRoomTitle(item, myUserId),
      listingId: item.marketplaceListingId ?? undefined
    });
  };

  return (
    <MobileAppShell hideTopBar omitBottomTabBar>
      <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
        {roomsQ.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={mobileColors.accent} />
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
              <ConversationSearchBar value={search} onChangeText={setSearch} />
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
                tintColor={mobileColors.accent}
              />
            }
            ItemSeparatorComponent={() => (
              <View style={{ height: mobileSpacing.xs }} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  {t("producer.messages.emptyTitle")}
                </Text>
                <Text style={styles.emptySub}>
                  {t("producer.messages.emptySub")}
                </Text>
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
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { padding: mobileSpacing.md, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  error: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    textAlign: "center"
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingTop: 64
  },
  emptyTitle: {
    ...mobileTypography.title,
    fontSize: 18,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: 10
  },
  emptySub: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 22
  },
});
