import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CreatePriceAlertModal } from "../../components/buyer/CreatePriceAlertModal";
import { PriceAlertCard } from "../../components/buyer/PriceAlertCard";
import {
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import {
  deleteBuyerPriceAlert,
  fetchBuyerPriceAlerts,
  updateBuyerPriceAlert
} from "../../lib/api";
import { mobileSpacing } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";

export function BuyerAlertsScreen() {
  const { t } = useTranslation();
  const bottomPad = useBuyerBottomChromePad();
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
      return updateBuyerPriceAlert(accessToken!, activeProfileId, id, { isActive });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["buyerPriceAlerts"] });
      void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
    },
    onError: (e: Error) => Alert.alert(t("buyer.alerts.errorTitle"), e.message),
    onSettled: () => setTogglingId(null)
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      deleteBuyerPriceAlert(accessToken!, activeProfileId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["buyerPriceAlerts"] });
      void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
    },
    onError: (e: Error) => Alert.alert(t("buyer.alerts.errorTitle"), e.message)
  });

  const alerts = alertsQ.data ?? [];

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomPad + 88 }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={alertsQ.isFetching && !alertsQ.isLoading}
            onRefresh={() => void alertsQ.refetch()}
            tintColor={buyerColors.primary}
          />
        }
      >
        <ScreenSection title={t("buyer.alerts.sectionList")} plain>
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
        </ScreenSection>
      </ScrollView>

      <Pressable
        style={[styles.fab, buyerShadow.floating, { bottom: bottomPad + mobileSpacing.lg }]}
        onPress={() => setCreateOpen(true)}
        accessibilityLabel={t("buyer.alerts.createCta")}
      >
        <Text style={styles.fabTx}>＋</Text>
      </Pressable>

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
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
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
    right: mobileSpacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: buyerColors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  fabTx: { color: "#fff", fontSize: 28, fontWeight: "300", marginTop: -2 }
});
