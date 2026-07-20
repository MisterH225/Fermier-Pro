import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CreatePriceAlertModal } from "./CreatePriceAlertModal";
import { PriceAlertCard } from "./PriceAlertCard";
import { useSession } from "../../context/SessionContext";
import {
  deleteBuyerPriceAlert,
  fetchBuyerPriceAlerts,
  updateBuyerPriceAlert
} from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import { mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  showFab?: boolean;
  fabBottom?: number;
};

export function BuyerAlertsPanel({ showFab = true, fabBottom = 24 }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const alertsQ = useQuery({
    queryKey: ["buyerPriceAlerts", activeProfileId],
    queryFn: () => fetchBuyerPriceAlerts(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      setTogglingId(id);
      return updateBuyerPriceAlert(accessToken!, activeProfileId, id, {
        isActive
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["buyerPriceAlerts"] });
      void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
    },
    onError: (e: Error) =>
      Alert.alert(t("buyer.alerts.errorTitle"), getUserFacingError(e, t)),
    onSettled: () => setTogglingId(null)
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      deleteBuyerPriceAlert(accessToken!, activeProfileId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["buyerPriceAlerts"] });
      void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
    },
    onError: (e: Error) =>
      Alert.alert(t("buyer.alerts.errorTitle"), getUserFacingError(e, t))
  });

  const alerts = alertsQ.data ?? [];

  return (
    <View style={styles.wrap}>
      {alertsQ.isLoading ? (
        <ActivityIndicator color={buyerColors.primary} style={styles.loader} />
      ) : alertsQ.error ? (
        <Text style={styles.error}>{(alertsQ.error as Error).message}</Text>
      ) : alerts.length === 0 ? (
        <View style={[styles.emptyCard, buyerShadow.card]}>
          <Text style={styles.emptyTitle}>{t("buyer.alerts.emptyTitle")}</Text>
          <Text style={styles.emptyBody}>{t("buyer.alerts.emptyBody")}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {alerts.map((alert) => (
            <PriceAlertCard
              key={alert.id}
              alert={alert}
              toggling={togglingId === alert.id}
              onToggleActive={(next) =>
                toggleMut.mutate({ id: alert.id, isActive: next })
              }
              onDelete={() => deleteMut.mutate(alert.id)}
            />
          ))}
        </View>
      )}

      {showFab ? (
        <Pressable
          style={[
            styles.fab,
            buyerShadow.floating,
            { bottom: fabBottom }
          ]}
          onPress={() => setCreateOpen(true)}
          accessibilityLabel={t("buyer.alerts.createCta")}
        >
          <Text style={styles.fabTx}>＋</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.inlineCta}
          onPress={() => setCreateOpen(true)}
        >
          <Text style={styles.inlineCtaTx}>{t("buyer.alerts.createCta")}</Text>
        </Pressable>
      )}

      <CreatePriceAlertModal
        visible={createOpen}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["buyerPriceAlerts"] });
          void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 200 },
  loader: { marginVertical: mobileSpacing.lg },
  error: { color: buyerColors.danger },
  list: { gap: mobileSpacing.md },
  emptyCard: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  emptyTitle: { fontWeight: "700", color: buyerColors.textPrimary },
  emptyBody: { color: buyerColors.textSecondary },
  fab: {
    position: "absolute",
    right: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: buyerColors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  fabTx: {
    color: buyerColors.onPrimary,
    fontSize: 28,
    fontWeight: "300",
    marginTop: -2
  },
  inlineCta: {
    marginTop: mobileSpacing.md,
    alignSelf: "flex-start",
    backgroundColor: buyerColors.primary,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: buyerRadius.button
  },
  inlineCtaTx: { color: buyerColors.onPrimary, fontWeight: "700" }
});
