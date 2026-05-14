import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  apiAuthHeaders,
  farmReportPdfAbsoluteUrl,
  generateFarmReport,
  type FarmReportPeriodType
} from "../../lib/api";
import type { ReportAnchorState } from "./PeriodSelector";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId: string | null | undefined;
  periodType: FarmReportPeriodType;
  anchor: ReportAnchorState;
  onGenerated?: () => void;
};

export function ExportPDFButton({
  farmId,
  accessToken,
  activeProfileId,
  periodType,
  anchor,
  onGenerated
}: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const bodyAnchor: { year: number; month?: number; quarter?: number } = {
        year: anchor.year
      };
      if (periodType === "monthly") {
        bodyAnchor.month = anchor.month;
      } else if (periodType === "quarterly") {
        bodyAnchor.quarter = anchor.quarter;
      }
      const gen = await generateFarmReport(accessToken, farmId, activeProfileId, {
        periodType,
        anchor: bodyAnchor
      });
      onGenerated?.();
      const url = farmReportPdfAbsoluteUrl(gen.id);
      const target = `${cacheDirectory ?? ""}rapport-${gen.id}.pdf`;
      const res = await downloadAsync(url, target, {
        headers: apiAuthHeaders(accessToken, activeProfileId ?? null)
      });
      if (res.status !== 200) {
        throw new Error(String(res.status));
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, {
          mimeType: "application/pdf",
          dialogTitle: t("reportsScreen.exportPdf")
        });
      } else {
        Alert.alert(t("reportsScreen.exportPdf"), t("reportsScreen.shareUnavailable"));
      }
    } catch (e) {
      Alert.alert(
        t("reportsScreen.exportErrorTitle"),
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Pressable
        onPress={() => void run()}
        disabled={busy}
        style={({ pressed }) => [
          styles.btn,
          { opacity: pressed || busy ? 0.85 : 1 }
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("reportsScreen.exportPdf")}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.btnTx}>📄 {t("reportsScreen.exportPdf")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: mobileSpacing.lg,
    right: mobileSpacing.lg,
    bottom: mobileSpacing.lg
  },
  btn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: mobileSpacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    ...mobileShadows.card
  },
  btnTx: {
    ...mobileTypography.body,
    color: "#FFFFFF",
    fontWeight: "800"
  }
});
