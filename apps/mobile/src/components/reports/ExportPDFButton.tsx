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
  fetchFarmReportDownloadUrl,
  generateFarmReport,
  type FarmReportPeriodType
} from "../../lib/api";
import type { ReportAnchorState } from "./PeriodSelector";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId: string | null | undefined;
  periodType: FarmReportPeriodType;
  anchor: ReportAnchorState;
  onGenerated?: () => void;
};

async function downloadAndShare(
  url: string,
  reportId: string,
  dialogTitle: string
): Promise<void> {
  const target = `${cacheDirectory ?? ""}rapport-${reportId}.pdf`;
  const res = await downloadAsync(url, target);
  if (res.status !== 200) {
    throw new Error(String(res.status));
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(res.uri, {
      mimeType: "application/pdf",
      dialogTitle
    });
  } else {
    Alert.alert(dialogTitle, "Le partage système n'est pas disponible.");
  }
}

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
  const [phase, setPhase] = useState<"idle" | "compiling" | "sharing">("idle");

  const run = async () => {
    setBusy(true);
    setPhase("compiling");
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
      setPhase("sharing");
      let url = gen.downloadUrl ?? null;
      if (!url) {
        const dl = await fetchFarmReportDownloadUrl(
          accessToken,
          farmId,
          gen.id,
          activeProfileId
        );
        url = dl.downloadUrl;
      }
      await downloadAndShare(url, gen.id, t("reportsScreen.exportPdf"));
    } catch (e) {
      Alert.alert(
        t("reportsScreen.exportErrorTitle"),
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  };

  const label =
    phase === "compiling"
      ? t("reportsScreen.compiling")
      : phase === "sharing"
        ? t("reportsScreen.downloading")
        : t("reportsScreen.generatePdf");

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
        accessibilityLabel={label}
      >
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={mobileColors.onAccent} />
            <Text style={styles.btnTx}>{label}</Text>
          </View>
        ) : (
          <Text style={styles.btnTx}>📄 {label}</Text>
        )}
      </Pressable>
    </View>
  );
}

export function ReportDownloadButton({
  farmId,
  reportId,
  accessToken,
  activeProfileId
}: {
  farmId: string;
  reportId: string;
  accessToken: string;
  activeProfileId: string | null | undefined;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { downloadUrl } = await fetchFarmReportDownloadUrl(
        accessToken,
        farmId,
        reportId,
        activeProfileId
      );
      await downloadAndShare(downloadUrl, reportId, t("reportsScreen.exportPdf"));
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
    <Pressable
      onPress={() => void run()}
      disabled={busy}
      style={({ pressed }) => [styles.dlBtn, pressed && { opacity: 0.85 }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={mobileColors.accent} />
      ) : (
        <Text style={styles.dlBtnTx}>{t("reportsScreen.downloadReport")}</Text>
      )}
    </Pressable>
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
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  btnTx: {
    ...mobileTypography.body,
    color: mobileColors.onAccent,
    fontWeight: "800"
  },
  dlBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.xs,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.sm,
    borderWidth: 1,
    borderColor: mobileColors.accent
  },
  dlBtnTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
