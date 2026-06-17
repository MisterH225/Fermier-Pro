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
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

export function FeedCommentInputBar({
  value,
  onChangeText,
  onSend,
  sending = false,
  placeholder = "Commenter…",
  disabled = false
}: Props) {
  const canSend = value.trim().length > 0 && !sending && !disabled;

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mobileColors.textSecondary}
        multiline
        maxLength={2000}
        editable={!sending && !disabled}
      />
      <Pressable
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={onSend}
        disabled={!canSend}
        hitSlop={8}
      >
        {sending ? (
          <ActivityIndicator color={mobileColors.onAccent} size="small" />
        ) : (
          <Ionicons name="send" size={18} color={mobileColors.onAccent} />
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
    marginTop: mobileSpacing.sm
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    fontSize: 15,
    color: mobileColors.textPrimary
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: {
    backgroundColor: mobileColors.border
  }
});
