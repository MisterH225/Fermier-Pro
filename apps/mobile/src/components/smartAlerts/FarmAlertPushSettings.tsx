import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  fetchFarmAlertSettings,
  putFarmAlertSettings
} from "../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { Card } from "../ui/Card";

type Props = {
  farmId: string;
};

type PushKey =
  | "pushStock"
  | "pushHealth"
  | "pushFinance"
  | "pushGestation"
  | "pushCheptel"
  | "pushMarket";

const PUSH_KEYS: PushKey[] = [
  "pushStock",
  "pushHealth",
  "pushFinance",
  "pushGestation",
  "pushCheptel",
  "pushMarket"
];

export function FarmAlertPushSettings({ farmId }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["farmAlertSettings", farmId, activeProfileId],
    queryFn: () => fetchFarmAlertSettings(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const saveMut = useMutation({
    mutationFn: (patch: { [K in PushKey]?: boolean }) =>
      putFarmAlertSettings(accessToken!, farmId, patch, activeProfileId),
    onSuccess: (data) => {
      qc.setQueryData(["farmAlertSettings", farmId, activeProfileId], data);
    }
  });

  const settings = settingsQ.data;

  return (
    <Card>
      <Text style={styles.sectionLabel}>{t("smartAlerts.settings.title")}</Text>
      <Text style={styles.hint}>{t("smartAlerts.settings.subtitle")}</Text>

      {settingsQ.isPending && !settings ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginTop: mobileSpacing.md }} />
      ) : null}

      {settings
        ? PUSH_KEYS.map((key) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{t(`smartAlerts.settings.${key}`)}</Text>
              <Switch
                value={settings[key]}
                disabled={saveMut.isPending}
                onValueChange={(value) => saveMut.mutate({ [key]: value })}
                trackColor={{
                  false: mobileColors.border,
                  true: "#c7ddff"
                }}
                thumbColor={settings[key] ? mobileColors.accent : "#f4f4f5"}
              />
            </View>
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  label: {
    ...mobileTypography.body,
    flex: 1,
    color: mobileColors.textPrimary
  }
});
