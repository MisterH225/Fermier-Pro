import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { ModuleFeatureGate } from "../components/ModuleFeatureGate";
import { useSession } from "../context/SessionContext";
import {
  type ChatSocketConnectionStatus,
  useChatRoomSocket
} from "../hooks/useChatRoomSocket";
import type { ChatMessageDto } from "../lib/api";
import { fetchChatMessages, postChatMessage } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRoom">;

type LiveStrip =
  | null
  | {
      kind: "pill";
      label: string;
      bg: string;
      fg: string;
      dot: string;
    }
  | {
      kind: "banner";
      label: string;
      bg: string;
      fg: string;
    };

function liveStripProps(status: ChatSocketConnectionStatus): LiveStrip {
  switch (status) {
    case "idle":
      return null;
    case "connecting":
      return {
        kind: "banner",
        label: "Connexion au salon…",
        bg: "#fff8e6",
        fg: "#6b5420"
      };
    case "connected":
      return {
        kind: "pill",
        label: "Temps réel actif",
        bg: "#e8f5e4",
        fg: "#2d5016",
        dot: "#43a047"
      };
    case "reconnecting":
      return {
        kind: "banner",
        label: "Reconnexion au salon…",
        bg: "#fff8e6",
        fg: "#6b5420"
      };
    case "disconnected":
      return {
        kind: "banner",
        label:
          "Flux temps réel interrompu — tirez la liste pour actualiser les messages.",
        bg: "#edece4",
        fg: "#4b513d"
      };
    case "error":
      return {
        kind: "banner",
        label:
          "Impossible d’ouvrir le flux temps réel. Les envois REST fonctionnent toujours.",
        bg: "#fdecea",
        fg: "#b00020"
      };
    default:
      return null;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

export function ChatRoomScreen({ route, navigation }: Props) {
  const { roomId, headline } = route.params;
  const { accessToken, activeProfileId, authMe, clientFeatures } =
    useSession();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessageDto>>(null);
  /** Si l’utilisateur est proche du bas ; au chargement on colle au dernier message. */
  const stickToBottomRef = useRef(true);
  const prevOrderedLenRef = useRef(0);
  const [showNewMessagesFab, setShowNewMessagesFab] = useState(false);

  const { chatSocketStatus } = useChatRoomSocket({
    roomId,
    accessToken,
    activeProfileId,
    enabled: clientFeatures.chat && !!accessToken
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: headline ?? "Conversation"
    });
  }, [navigation, headline]);

  useEffect(() => {
    prevOrderedLenRef.current = 0;
    setShowNewMessagesFab(false);
  }, [roomId]);

  const messagesQuery = useQuery({
    queryKey: ["chatMessages", roomId, activeProfileId],
    queryFn: () =>
      fetchChatMessages(accessToken, roomId, activeProfileId, { take: 80 })
  });

  const ordered = useMemo(() => {
    const rows = messagesQuery.data ?? [];
    return [...rows].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messagesQuery.data]);

  const myUserId = authMe?.user.id;

  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        e.nativeEvent;
      const threshold = 120;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      const nearBottom = distanceFromBottom < threshold;
      stickToBottomRef.current = nearBottom;
      if (nearBottom) {
        setShowNewMessagesFab(false);
      }
    },
    []
  );

  const scrollListToEnd = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (ordered.length === 0) return;
    const last = ordered[ordered.length - 1];
    const shouldStick =
      stickToBottomRef.current ||
      (myUserId != null && last.senderUserId === myUserId);
    if (!shouldStick) return;
    scrollListToEnd(true);
  }, [ordered, myUserId, scrollListToEnd]);

  /** Bouton « Nouveaux messages » : uniquement si des messages d’autres arrivent alors qu’on n’est pas en bas. */
  useEffect(() => {
    const n = ordered.length;
    const prev = prevOrderedLenRef.current;
    if (
      myUserId != null &&
      n > prev &&
      prev > 0 &&
      !stickToBottomRef.current
    ) {
      const newest = ordered[ordered.length - 1];
      if (newest.senderUserId !== myUserId) {
        setShowNewMessagesFab(true);
      }
    }
    prevOrderedLenRef.current = n;
  }, [ordered, myUserId]);

  const jumpToLatestMessages = useCallback(() => {
    stickToBottomRef.current = true;
    setShowNewMessagesFab(false);
    scrollListToEnd(true);
  }, [scrollListToEnd]);

  const onListContentSizeChange = useCallback(() => {
    if (!stickToBottomRef.current) return;
    scrollListToEnd(false);
  }, [scrollListToEnd]);

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      postChatMessage(accessToken, roomId, body, activeProfileId),
    onSuccess: (msg) => {
      setDraft("");
      qc.setQueryData<ChatMessageDto[]>(
        ["chatMessages", roomId, activeProfileId],
        (old) => {
          if (!old) return [msg];
          if (old.some((m) => m.id === msg.id)) return old;
          return [...old, msg];
        }
      );
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
    }
  });

  const renderItem = useCallback(
    ({ item }: { item: ChatMessageDto }) => {
      const mine = item.senderUserId === myUserId;
      return (
        <View
          style={[styles.bubbleRow, mine ? styles.bubbleRowMine : undefined]}
        >
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            {!mine ? (
              <Text style={styles.senderName}>
                {item.sender?.fullName?.trim() || "Participant"}
              </Text>
            ) : null}
            <Text style={[styles.msgBody, mine ? styles.msgBodyMine : undefined]}>
              {item.body}
            </Text>
            <Text style={[styles.msgMeta, mine ? styles.msgMetaMine : undefined]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [myUserId]
  );

  const onSend = () => {
    const t = draft.trim();
    if (!t || sendMutation.isPending) return;
    sendMutation.mutate(t);
  };

  const liveStrip = liveStripProps(chatSocketStatus);

  return (
    <ModuleFeatureGate feature="chat">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {liveStrip ? (
          liveStrip.kind === "pill" ? (
            <View
              style={[styles.livePillStrip, { backgroundColor: liveStrip.bg }]}
            >
              <View
                style={[styles.liveDot, { backgroundColor: liveStrip.dot }]}
                accessibilityLabel="Connexion temps réel active"
              />
              <Text style={[styles.livePillText, { color: liveStrip.fg }]}>
                {liveStrip.label}
              </Text>
            </View>
          ) : (
            <View style={[styles.liveStrip, { backgroundColor: liveStrip.bg }]}>
              <Text style={[styles.liveStripText, { color: liveStrip.fg }]}>
                {liveStrip.label}
              </Text>
            </View>
          )
        ) : null}
        {messagesQuery.isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : messagesQuery.error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>
              {messagesQuery.error instanceof Error
                ? messagesQuery.error.message
                : String(messagesQuery.error)}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            <FlatList
              ref={listRef}
              data={ordered}
              keyExtractor={(m) => m.id}
              renderItem={renderItem}
              style={styles.listFlex}
              contentContainerStyle={styles.listContent}
              onScroll={onListScroll}
              scrollEventThrottle={100}
              onContentSizeChange={onListContentSizeChange}
              refreshControl={
                <RefreshControl
                  refreshing={messagesQuery.isRefetching}
                  onRefresh={() => void messagesQuery.refetch()}
                  tintColor="#5d7a1f"
                />
              }
            />
            {showNewMessagesFab ? (
              <TouchableOpacity
                style={styles.newMessagesFab}
                onPress={jumpToLatestMessages}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Aller aux nouveaux messages"
              >
                <Text style={styles.newMessagesFabChevron}>↓</Text>
                <Text style={styles.newMessagesFabText}>Nouveaux messages</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrire un message…"
            placeholderTextColor="#9aa088"
            multiline
            maxLength={4000}
            editable={!sendMutation.isPending}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!draft.trim() || sendMutation.isPending) && styles.sendBtnDisabled
            ]}
            onPress={onSend}
            disabled={!draft.trim() || sendMutation.isPending}
          >
            <Text style={styles.sendBtnText}>Envoyer</Text>
          </TouchableOpacity>
        </View>
        {sendMutation.error ? (
          <Text style={styles.sendError}>
            {sendMutation.error instanceof Error
              ? sendMutation.error.message
              : String(sendMutation.error)}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </ModuleFeatureGate>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  liveStrip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e4d4"
  },
  livePillStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d4e8d0",
    gap: 8
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  livePillText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  },
  liveStripText: {
    fontSize: 13,
    lineHeight: 18
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  error: { color: "#b00020", textAlign: "center", fontSize: 14 },
  listWrap: { flex: 1, position: "relative" },
  listFlex: { flex: 1 },
  newMessagesFab: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    zIndex: 20,
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#5d7a1f",
    paddingVertical: 10,
    paddingHorizontal: 18,
    paddingLeft: 14,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5
  },
  newMessagesFabChevron: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 1
  },
  newMessagesFabText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700"
  },
  listContent: {
    padding: 16,
    paddingBottom: 8
  },
  bubbleRow: {
    alignItems: "flex-start",
    marginBottom: 12
  },
  bubbleRowMine: {
    alignItems: "flex-end"
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1
  },
  bubbleMine: {
    backgroundColor: "#5d7a1f",
    borderColor: "#4a6118"
  },
  bubbleOther: {
    backgroundColor: "#fff",
    borderColor: "#e0e4d4"
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5d7a1f",
    marginBottom: 4
  },
  msgBody: {
    fontSize: 16,
    color: "#1f2910",
    lineHeight: 22
  },
  msgBodyMine: {
    color: "#fff"
  },
  msgMeta: {
    marginTop: 6,
    fontSize: 11,
    color: "#6d745b"
  },
  msgMetaMine: {
    color: "#dfe8c8"
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e4d4",
    backgroundColor: "#fdfcf5"
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4dac8",
    backgroundColor: "#fff",
    fontSize: 16,
    color: "#1f2910"
  },
  sendBtn: {
    backgroundColor: "#5d7a1f",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14
  },
  sendBtnDisabled: {
    opacity: 0.45
  },
  sendBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15
  },
  sendError: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    color: "#b00020",
    fontSize: 12
  }
});
