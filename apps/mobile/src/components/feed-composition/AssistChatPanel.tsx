import {
  ActivityIndicator,
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
  onInputFocus?: () => void;
};

/**
 * Chat local (pas Socket.IO). Pas de FlatList imbriquée : le parent ScrollView
 * gère le défilement pour éviter les gestes « coincés ».
 */
export function AssistChatPanel({
  messages,
  draft,
  onChangeDraft,
  onSend,
  sending,
  placeholder = "Ex. : j’ai 30 porcs à engraisser pendant un mois, propose-moi un mélange",
  onInputFocus
}: Props) {
  return (
    <View style={styles.wrap} testID="assist-chat-panel">
      {messages.length === 0 ? (
        <Text style={styles.emptyHint}>
          Expliquez simplement ce que vous voulez faire (combien de porcs, quel
          âge / poids, pour combien de temps). On vous guide étape par étape.
        </Text>
      ) : (
        <View style={styles.list}>
          {messages.map((item, i) => {
            const mine = item.role === "user";
            return (
              <View
                key={`m-${i}`}
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
          })}
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={placeholder}
          placeholderTextColor={mobileColors.textSecondary}
          multiline
          editable={!sending}
          onFocus={onInputFocus}
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
  wrap: { gap: mobileSpacing.sm },
  list: {
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  emptyHint: {
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm,
    lineHeight: 20,
    paddingVertical: mobileSpacing.sm
  },
  row: { flexDirection: "row" },
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
