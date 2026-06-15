import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
};

export function AppealModal({ visible, onClose, onSubmit }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (message.trim().length < 10) {
      setError("Merci de détailler votre contestation (10 caractères minimum).");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await onSubmit(message.trim());
      setMessage("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kavWrap}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, mobileSpacing.md) }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Contester cette décision</Text>
            <Text style={styles.hint}>
              Expliquez pourquoi vous pensez que cette sanction est injustifiée. Un administrateur
              répondra sous 72 heures.
            </Text>
            <TextInput
              style={styles.input}
              multiline
              value={message}
              onChangeText={setMessage}
              placeholder="Votre message…"
              placeholderTextColor={mobileColors.textSecondary}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelTx}>Annuler</Text>
            </Pressable>
            <Pressable onPress={() => void handleSubmit()} style={styles.submitBtn} disabled={sending}>
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitTx}>Envoyer</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kavWrap: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingBottom: 8
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  sheet: {
    backgroundColor: mobileColors.surface,
    borderRadius: 24,
    overflow: "hidden",
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.title,
    fontSize: 18
  },
  hint: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    fontSize: 13
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    textAlignVertical: "top",
    ...mobileTypography.body
  },
  error: {
    ...mobileTypography.meta,
    color: mobileColors.error
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.sm
  },
  cancelBtn: { padding: mobileSpacing.sm },
  cancelTx: { ...mobileTypography.body, color: mobileColors.textSecondary },
  submitBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    minWidth: 100,
    alignItems: "center"
  },
  submitTx: { ...mobileTypography.body, color: "#fff", fontWeight: "600" }
});
