import { useMutation } from "@tanstack/react-query";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PrimaryButton } from "../ui/PrimaryButton";
import { SecondaryButton } from "../ui/SecondaryButton";
import { regenerateMarketplaceReceipt } from "../../lib/api";
import { downloadAndShareReceiptPdf } from "../../lib/downloadMarketplaceReceipt";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  transactionId: string;
  accessToken: string;
  activeProfileId?: string | null;
  receiptGenerationStatus?: string;
  receipt?: {
    id: string;
    receiptNumber: string;
    generatedAt: string;
  } | null;
  onReceiptUpdated?: () => void;
};

export function TransactionReceiptCard({
  transactionId,
  accessToken,
  activeProfileId,
  receiptGenerationStatus,
  receipt,
  onReceiptUpdated
}: Props) {
  const { t } = useTranslation();

  const downloadMut = useMutation({
    mutationFn: async () => {
      await downloadAndShareReceiptPdf(
        transactionId,
        accessToken,
        activeProfileId,
        receipt?.receiptNumber
      );
    },
    onSuccess: () => {
      onReceiptUpdated?.();
    },
    onError: (e: Error) => {
      Alert.alert(
        t("marketScreen.transaction.receiptErrorTitle"),
        e.message || t("marketScreen.transaction.receiptErrorBody")
      );
    }
  });

  const retryMut = useMutation({
    mutationFn: async () => {
      const row = await regenerateMarketplaceReceipt(
        accessToken,
        transactionId,
        activeProfileId
      );
      if (!row.receiptNumber || row.status !== "generated") {
        throw new Error(t("marketScreen.transaction.receiptNotReady"));
      }
      return row;
    },
    onSuccess: () => {
      onReceiptUpdated?.();
    },
    onError: (e: Error) => {
      Alert.alert(
        t("marketScreen.transaction.receiptErrorTitle"),
        e.message || t("marketScreen.transaction.receiptErrorBody")
      );
    }
  });

  const status = receiptGenerationStatus ?? "pending";
  const hasReceiptNumber = Boolean(receipt?.receiptNumber);
  const isFailed = status === "failed" && !hasReceiptNumber;
  const isPending = !hasReceiptNumber && status === "pending";
  const retrying = retryMut.isPending;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("marketScreen.transaction.receiptTitle")}</Text>
      {hasReceiptNumber ? (
        <>
          <Text style={styles.line}>
            {t("marketScreen.transaction.receiptNumber", {
              number: receipt!.receiptNumber
            })}
          </Text>
          <Text style={styles.muted}>
            {t("marketScreen.transaction.receiptGeneratedAt", {
              date: new Date(receipt!.generatedAt).toLocaleString("fr-FR")
            })}
          </Text>
        </>
      ) : null}
      <View style={{ marginTop: mobileSpacing.sm }}>
        <PrimaryButton
          label={t("marketScreen.transaction.receiptDownload")}
          onPress={() => downloadMut.mutate()}
          loading={downloadMut.isPending}
        />
      </View>
      {isPending ? (
        <View style={styles.pendingRow}>
          <ActivityIndicator color={mobileColors.accent} />
          <Text style={styles.muted}>
            {t("marketScreen.transaction.receiptGenerating")}
          </Text>
        </View>
      ) : null}
      {isFailed ? (
        <>
          <Text style={styles.error}>{t("marketScreen.transaction.receiptFailed")}</Text>
          <View style={{ marginTop: mobileSpacing.sm }}>
            <SecondaryButton
              label={t("marketScreen.transaction.receiptRetry")}
              onPress={() => retryMut.mutate()}
              loading={retrying}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md
  },
  title: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.xs
  },
  line: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  muted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  error: {
    ...mobileTypography.body,
    color: mobileColors.error,
    marginTop: mobileSpacing.sm
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  }
});
