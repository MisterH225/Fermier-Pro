import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { openPhoneCall } from "../../lib/phone";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type VisitCardProps = {
  farmName: string;
  producerName: string | null;
  producerPhone?: string | null;
  scheduledAt: string;
  subject: string;
  location: string | null;
  onMessage?: () => void;
  onCall?: () => void;
  /** Si fourni, le bouton 📞 ouvre le composeur (sinon `onCall`). */
  callPhone?: string | null;
  onPress?: () => void;
  width?: number;
};

function formatWhen(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function VisitCard({
  farmName,
  producerName,
  producerPhone,
  scheduledAt,
  subject,
  location,
  onMessage,
  onCall,
  callPhone,
  onPress,
  width = 280
}: VisitCardProps) {
  const { t } = useTranslation();
  const locale = "fr-FR";
  const phone = callPhone ?? producerPhone;

  const handleCall = () => {
    if (phone) {
      void openPhoneCall(phone, {
        errorTitle: t("vet.call.errorTitle"),
        errorMessage: t("vet.call.error")
      });
      return;
    }
    onCall?.();
  };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        { width, opacity: pressed ? 0.94 : 1 },
        vetShadow.card
      ]}
    >
      <View style={styles.gradient}>
        <View style={styles.content}>
          <Text style={styles.farm} numberOfLines={1}>
            {farmName}
          </Text>
          {producerName ? (
            <Text style={styles.producer} numberOfLines={1}>
              {producerName}
            </Text>
          ) : null}
          <Text style={styles.when}>{formatWhen(scheduledAt, locale)}</Text>
          <Text style={styles.subject} numberOfLines={2}>
            {subject}
          </Text>
          {location ? (
            <Text style={styles.location} numberOfLines={1}>
              📍 {location}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              onPress={onMessage}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={handleCall}
              accessibilityRole="button"
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: vetRadius.card,
    overflow: "hidden",
    marginRight: mobileSpacing.md
  },
  gradient: {
    borderRadius: vetRadius.card,
    minHeight: 160,
    backgroundColor: vetColors.primary
  },
  content: { padding: mobileSpacing.lg, gap: 4 },
  farm: {
    ...mobileTypography.title,
    fontSize: 17,
    fontWeight: "800",
    color: "#fff"
  },
  producer: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.85)"
  },
  when: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4
  },
  subject: {
    ...mobileTypography.body,
    color: "rgba(255,255,255,0.95)",
    marginTop: 2
  },
  location: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.8)"
  },
  actions: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.md
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center"
  }
});
