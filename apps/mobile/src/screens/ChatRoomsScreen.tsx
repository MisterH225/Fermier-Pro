import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLayoutEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { ChatModuleGate } from "../components/ChatModuleGate";
import { ConversationRow } from "../components/messaging/ConversationRow";
import { useBottomInset } from "../hooks/useBottomInset";
import { useChatRoomsQuery } from "../hooks/useChatRoomsQuery";
import { useSession } from "../context/SessionContext";
import { chatRoomTitle } from "../lib/messaging/chatRoomDisplay";
import { mobileColors, mobileHeaderButtonOnDark } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { getUserFacingError } from "../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRooms">;

export function ChatRoomsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const { authMe } = useSession();
  const myUserId = authMe?.user.id;
  const roomsQuery = useChatRoomsQuery("chatRooms");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("ChatPickFarm")}
          style={mobileHeaderButtonOnDark.btn}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={mobileHeaderButtonOnDark.text}>
            {t("chat.newConversation")}
          </Text>
        </TouchableOpacity>
      )
    });
  }, [navigation, t]);

  const rooms = roomsQuery.data ?? [];

  return (
    <ChatModuleGate>
      <View style={styles.wrap}>
        {roomsQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={mobileColors.accent} />
          </View>
        ) : roomsQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {getUserFacingError(roomsQuery.error, t)}
            </Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              rooms.length === 0
                ? [styles.emptyList, { paddingBottom: bottomInset }]
                : [styles.list, { paddingBottom: bottomInset }]
            }
            refreshControl={
              <RefreshControl
                refreshing={roomsQuery.isRefetching}
                onRefresh={() => void roomsQuery.refetch()}
                tintColor={mobileColors.accent}
              />
            }
            ListEmptyComponent={
              <Text style={styles.empty}>{t("chat.emptyRooms")}</Text>
            }
            renderItem={({ item }) => (
              <ConversationRow
                room={item}
                myUserId={myUserId}
                onPress={() =>
                  navigation.navigate("ChatRoom", {
                    roomId: item.id,
                    headline: chatRoomTitle(item, myUserId)
                  })
                }
              />
            )}
          />
        )}
      </View>
    </ChatModuleGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { padding: 16 },
  emptyList: { flexGrow: 1, justifyContent: "center", padding: 24 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  error: { color: mobileColors.error, textAlign: "center" },
  empty: { textAlign: "center", color: mobileColors.textSecondary }
});
