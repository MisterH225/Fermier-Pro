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
import { ChatModuleGate } from "../components/ChatModuleGate";
import { useSession } from "../context/SessionContext";
import {
  type ChatSocketConnectionStatus,
  useChatRoomSocket
} from "../hooks/useChatRoomSocket";
import type { ChatMessageDto } from "../lib/api";
import { fetchChatMessages, postChatMessage } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

const CHAT_PAGE_SIZE = 40;

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
  /** Dernier message « en tête du fil » (le plus récent) — détecte prepend vs nouveaux messages. */
  const tipNewestIdRef = useRef<string | null>(null);
  /** Nombre de nouveaux messages (autres) arrivés hors vue en bas de liste. */
  const [pendingBelowCount, setPendingBelowCount] = useState(0);
  const hasMoreOlderRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

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
    tipNewestIdRef.current = null;
    setPendingBelowCount(0);
    hasMoreOlderRef.current = true;
  }, [roomId]);

  const messagesQuery = useQuery({
    queryKey: ["chatMessages", roomId, activeProfileId],
    queryFn: () =>
      fetchChatMessages(accessToken, roomId, activeProfileId, {
        take: CHAT_PAGE_SIZE
      })
  });

  useEffect(() => {
    if (!messagesQuery.isSuccess || messagesQuery.data === undefined) {
      return;
    }
    const len = messagesQuery.data.length;
    if (len === 0) {
      hasMoreOlderRef.current = false;
      return;
    }
    if (len < CHAT_PAGE_SIZE) {
      hasMoreOlderRef.current = false;
    }
  }, [messagesQuery.isSuccess, messagesQuery.data, roomId]);

  const tryLoadOlder = useCallback(async () => {
    if (!hasMoreOlderRef.current || loadingOlderRef.current) return;
    const raw =
      qc.getQueryData<ChatMessageDto[]>([
        "chatMessages",
        roomId,
        activeProfileId
      ]) ?? [];
    const sorted = [...raw].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const oldestId = sorted[0]?.id;
    if (!oldestId) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const older = await fetchChatMessages(
        accessToken,
        roomId,
        activeProfileId,
        { cursor: oldestId, take: CHAT_PAGE_SIZE }
      );
      if (older.length === 0) {
        hasMoreOlderRef.current = false;
        return;
      }
      if (older.length < CHAT_PAGE_SIZE) {
        hasMoreOlderRef.current = false;
      }
      qc.setQueryData<ChatMessageDto[]>(
        ["chatMessages", roomId, activeProfileId],
        (old) => {
          const merged = [...(old ?? []), ...older];
          const map = new Map(merged.map((m) => [m.id, m]));
          return Array.from(map.values());
        }
      );
    } catch {
      hasMoreOlderRef.current = false;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [accessToken, roomId, activeProfileId, qc]);

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
      const thresholdBottom = 120;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      const nearBottom = distanceFromBottom < thresholdBottom;
      stickToBottomRef.current = nearBottom;
      if (nearBottom) {
        setPendingBelowCount(0);
      }

      const topThreshold = 100;
      if (
        contentOffset.y < topThreshold &&
        hasMoreOlderRef.current &&
        !loadingOlderRef.current
      ) {
        void tryLoadOlder();
      }
    },
    [tryLoadOlder]
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

  /**
   * Nouveaux messages en bas : ignore le chargement d’historique (prepend conserve le même
   * dernier message que tipNewestIdRef).
   */
  useEffect(() => {
    const n = ordered.length;
    const prev = prevOrderedLenRef.current;
    const newest = ordered[n - 1];
    const newestId = newest?.id ?? null;

    if (
      n > prev &&
      prev > 0 &&
      newestId != null &&
      newestId === tipNewestIdRef.current
    ) {
      prevOrderedLenRef.current = n;
      return;
    }

    if (
      myUserId != null &&
      n > prev &&
      prev > 0 &&
      !stickToBottomRef.current &&
      newest &&
      newest.senderUserId !== myUserId &&
      newestId !== tipNewestIdRef.current
    ) {
      setPendingBelowCount((c) => Math.min(c + (n - prev), 99));
    }

    tipNewestIdRef.current = newestId;
    prevOrderedLenRef.current = n;
  }, [ordered, myUserId]);

  const jumpToLatestMessages = useCallback(() => {
    stickToBottomRef.current = true;
    setPendingBelowCount(0);
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
    <ChatModuleGate>
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
              maintainVisibleContentPosition={{
                minIndexForVisible: 0
              }}
              ListHeaderComponent={
                loadingOlder ? (
                  <View style={styles.loadOlderBanner}>
                    <ActivityIndicator size="small" color="#5d7a1f" />
                    <Text style={styles.loadOlderText}>Messages plus anciens…</Text>
                  </View>
                ) : null
              }
              refreshControl={
                <RefreshControl
                  refreshing={messagesQuery.isRefetching}
                  onRefresh={() => {
                    hasMoreOlderRef.current = true;
                    void messagesQuery.refetch().then(() => {
                      const d = qc.getQueryData<ChatMessageDto[]>([
                        "chatMessages",
                        roomId,
                        activeProfileId
                      ]);
                      const len = d?.length ?? 0;
                      if (len < CHAT_PAGE_SIZE) {
                        hasMoreOlderRef.current = false;
                      }
                    });
                  }}
                  tintColor="#5d7a1f"
                />
              }
            />
            {pendingBelowCount > 0 ? (
              <TouchableOpacity
                style={styles.newMessagesFab}
                onPress={jumpToLatestMessages}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={`Aller aux nouveaux messages, ${pendingBelowCount}`}
              >
                <Text style={styles.newMessagesFabChevron}>↓</Text>
                <Text style={styles.newMessagesFabText}>Nouveaux messages</Text>
                <View style={styles.newMessagesFabBadge}>
                  <Text style={styles.newMessagesFabBadgeText}>
                    {pendingBelowCount > 99 ? "99+" : String(pendingBelowCount)}
                  </Text>
                </View>
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
    </ChatModuleGate>
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
  loadOlderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
    marginBottom: 8
  },
  loadOlderText: {
    fontSize: 13,
    color: "#6d745b"
  },
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
  newMessagesFabBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  newMessagesFabBadgeText: {
    color: "#5d7a1f",
    fontSize: 12,
    fontWeight: "800"
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
