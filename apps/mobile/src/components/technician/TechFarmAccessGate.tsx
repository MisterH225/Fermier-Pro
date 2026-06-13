import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTechFarmPermissions } from "../../hooks/useTechFarmPermissions";
import type { TechFarmModuleKey } from "../../lib/technicianPermissions";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors } from "../../theme/technicianTheme";
import { TechReadOnlyBanner } from "./TechReadOnlyBanner";

type Props = {
  farmId: string;
  module: TechFarmModuleKey;
  children: (ctx: { readOnly: boolean }) => ReactNode;
};

export function TechFarmAccessGate({ farmId, module, children }: Props) {
  const { t } = useTranslation();
  const perms = useTechFarmPermissions(farmId, module);

  if (perms.isTech && perms.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={techColors.primary} />
      </View>
    );
  }

  if (perms.isTech && !perms.canView) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{t("tech.permissionDenied")}</Text>
      </View>
    );
  }

  return (
    <>
      {perms.readOnly ? <TechReadOnlyBanner /> : null}
      {children({ readOnly: perms.readOnly })}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.canvas
  },
  error: {
    ...mobileTypography.body,
    color: mobileColors.error,
    textAlign: "center"
  }
});
