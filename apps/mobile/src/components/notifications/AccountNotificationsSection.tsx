import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AdminMessageCard } from "../admin/AdminMessageCard";
import { useAdminMessagesInbox } from "../../hooks/useAdminMessagesInbox";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const DASHBOARD_PREVIEW = 5;

type Props = {
  /** Si défini, le lien « Tout voir » ouvre la liste notifications de la ferme. */
  farmId?: string;
  farmName?: string;
};

export function AccountNotificationsSection({ farmId, farmName }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, isLoading, markRead } = useAdminMessagesInbox();

  const preview = items.slice(0, DASHBOARD_PREVIEW);
  const showSeeAll = items.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.sectionTitle}>
          {t("smartAlerts.sectionTitle")}
        </Text>
        {showSeeAll ? (
          <Pressable
            onPress={() =>
              navigation.navigate(
                "SmartAlertsList",
                farmId && farmName ? { farmId, farmName } : {}
              )
            }
            hitSlop={12}
          >
            <Text style={styles.linkAll}>{t("smartAlerts.seeAll")}</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading && preview.length === 0 ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : preview.length === 0 ? (
        <Text style={styles.empty}>{t("smartAlerts.adminEmpty")}</Text>
      ) : (
        preview.map((m) => (
          <AdminMessageCard
            key={m.id}
            msg={m}
            onMarkRead={(id) => void markRead(id)}
            adminTag={t("smartAlerts.adminTag")}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.sm
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 17,
    color: mobileColors.textPrimary
  },
  linkAll: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  }
});
