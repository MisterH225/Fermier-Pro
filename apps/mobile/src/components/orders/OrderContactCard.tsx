import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import { ordersPalette, type OrderPalette } from "./orderTheme";

type Props = {
  displayName: string;
  onMessage?: () => void;
  onCall?: () => void;
  phone?: string | null;
  palette?: OrderPalette;
  /** Sous-titre conservé pour les écrans boutique historiques. */
  subtitle?: string;
  messageBusy?: boolean;
};

export function OrderContactCard({
  displayName,
  onMessage,
  onCall,
  phone,
  palette = ordersPalette,
  subtitle,
  messageBusy
}: Props) {
  const { t } = useTranslation();
  const canCall = Boolean(onCall || phone?.trim());
  const initial = (displayName.trim().charAt(0) || "?").toUpperCase();

  const handleCall = () => {
    if (onCall) {
      onCall();
      return;
    }
    if (phone?.trim()) {
      void Linking.openURL(`tel:${phone.trim()}`);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.cardBg,
          borderRadius: palette.radius.card,
          borderColor: palette.border
        },
        palette.shadow.card
      ]}
    >
      <View
        style={[styles.avatar, { backgroundColor: palette.primaryLight }]}
      >
        <Text style={[styles.avatarText, { color: palette.primary }]}>
          {initial}
        </Text>
      </View>
      <View style={styles.body}>
        <Text
          style={[styles.name, { color: palette.textPrimary }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onMessage ? (
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: palette.primaryLight }
            ]}
            onPress={onMessage}
            disabled={messageBusy}
            accessibilityRole="button"
            accessibilityLabel={t("orders.contact.message", {
              defaultValue: "Message"
            })}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={18}
              color={palette.primaryDark}
            />
          </Pressable>
        ) : null}
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: palette.primary },
            !canCall && styles.disabled
          ]}
          onPress={handleCall}
          disabled={!canCall}
          accessibilityRole="button"
          accessibilityLabel={t("orders.contact.call", {
            defaultValue: "Appeler"
          })}
        >
          <Ionicons name="call" size={18} color={palette.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: mobileSpacing.md,
    borderWidth: 1
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800"
  },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800"
  },
  subtitle: {
    fontSize: mobileFontSize.sm,
    fontWeight: "500"
  },
  actions: { flexDirection: "row", gap: 8 },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center"
  },
  disabled: { opacity: 0.35 }
});
