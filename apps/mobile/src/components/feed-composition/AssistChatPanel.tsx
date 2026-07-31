import { useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { FeedCompositionChatMessage } from "../../lib/api/feed-composition";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = {
  messages: FeedCompositionChatMessage[];
  draft: string;
  onChangeDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
};

/** Chat léger local (pas la messagerie Socket.IO) — bulles inspirées MessageBubble. */
export function AssistChatPanel({
  messages,
  draft,
  onChangeDraft,
  onSend,
  sending,
  placeholder = "Ex. : je veux nourrir 30 porcs à l’engraissement pendant un mois"
}: Props) {
  const listRef = useRef<FlatList<FeedCompositionChatMessage>>(null);

  return (
    <View style={styles.wrap} testID="assist-chat-panel">
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => `m-${i}`}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            Décrivez votre besoin en phrases simples. L’assistant posera les
            questions manquantes.
          </Text>
        }
        renderItem={({ item }) => {
          const mine = item.role === "user";
          return (
            <View
              style={[styles.row, mine ? styles.rowMine : styles.rowOther]}
              testID={mine ? "chat-bubble-user" : "chat-bubble-assistant"}
            >
              <View
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleOther
                ]}
              >
                {!mine ? (
                  <Text style={styles.sender}>Assistant</Text>
                ) : null}
                <Text style={[styles.body, mine && styles.bodyMine]}>
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={placeholder}
          placeholderTextColor={mobileColors.textSecondary}
          multiline
          editable={!sending}
          testID="assist-chat-input"
        />
        <Pressable
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendDisabled]}
          onPress={onSend}
          disabled={!draft.trim() || sending}
          testID="assist-chat-send"
        >
          {sending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.sendLabel}>Envoyer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 220 },
  list: {
    paddingVertical: mobileSpacing.sm,
    gap: mobileSpacing.sm,
    flexGrow: 1
  },
  emptyHint: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    lineHeight: 20,
    padding: mobileSpacing.md
  },
  row: { flexDirection: "row", marginBottom: mobileSpacing.sm },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "88%",
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  bubbleMine: {
    backgroundColor: mobileColors.accent
  },
  bubbleOther: {
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  sender: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    marginBottom: 2
  },
  body: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    lineHeight: 22
  },
  bodyMine: {
    color: mobileColors.onAccent
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: mobileSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border,
    paddingTop: mobileSpacing.sm
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  sendBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center"
  },
  sendDisabled: { opacity: 0.5 },
  sendLabel: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  }
});
