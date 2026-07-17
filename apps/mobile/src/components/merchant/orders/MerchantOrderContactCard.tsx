import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { merchantColors, merchantRadius, merchantShadow } from "../../../theme/merchantTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

type Props = {
  name: string;
  subtitle: string;
  phone?: string | null;
  onMessage: () => void;
  messageBusy?: boolean;
};

export function MerchantOrderContactCard({
  name,
  subtitle,
  phone,
  onMessage,
  messageBusy
}: Props) {
  const { t } = useTranslation();
  const canCall = Boolean(phone?.trim());

  const onCall = () => {
    if (!phone?.trim()) return;
    void Linking.openURL(`tel:${phone.trim()}`);
  };

  const initial = (name.trim().charAt(0) || "?").toUpperCase();

  return (
    <View style={[styles.card, merchantShadow.card]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTx}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.msgBtn}
          onPress={onMessage}
          disabled={messageBusy}
          accessibilityRole="button"
          accessibilityLabel={t("merchant.orders.message")}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={merchantColors.primaryDark} />
        </Pressable>
        <Pressable
          style={[styles.callBtn, !canCall && styles.callBtnDisabled]}
          onPress={onCall}
          disabled={!canCall}
          accessibilityRole="button"
          accessibilityLabel={t("merchant.orders.contact.call")}
        >
          <Ionicons name="call" size={18} color="#fff" />
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
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    fontSize: 18,
    fontWeight: "800",
    color: merchantColors.primary
  },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: merchantColors.textPrimary
  },
  sub: {
    fontSize: 12,
    color: merchantColors.textSecondary,
    fontWeight: "500"
  },
  actions: { flexDirection: "row", gap: 8 },
  msgBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: merchantColors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  callBtnDisabled: { opacity: 0.35 }
});
