import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
};

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  sending = false,
  placeholder = "Votre message…"
}: Props) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View style={styles.bar}>
      <Pressable style={styles.attachBtn} hitSlop={8}>
        <Ionicons
          name="attach-outline"
          size={22}
          color={mobileColors.textSecondary}
        />
      </Pressable>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mobileColors.textSecondary}
        multiline
        maxLength={4000}
        editable={!sending}
      />
      <Pressable
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={onSend}
        disabled={!canSend}
        hitSlop={8}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="send" size={18} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: 15,
    color: mobileColors.textPrimary
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: {
    backgroundColor: mobileColors.border
  }
});
