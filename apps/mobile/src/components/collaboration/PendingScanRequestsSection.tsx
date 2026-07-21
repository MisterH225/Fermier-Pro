import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  fetchFarmPendingInvitations,
  type FarmInvitationPendingDto
} from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { RespondScanRequestModal } from "./RespondScanRequestModal";

type Props = {
  farmId: string;
};

export function PendingScanRequestsSection({ farmId }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [selected, setSelected] = useState<FarmInvitationPendingDto | null>(
    null
  );

  const q = useQuery({
    queryKey: ["farmPendingInvitations", farmId, activeProfileId],
    queryFn: () => fetchFarmPendingInvitations(accessToken, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const scanRequests = useMemo(
    () => (q.data ?? []).filter((inv) => inv.kind === "scan_request"),
    [q.data]
  );

  if (q.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  if (scanRequests.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>
          {t("collab.scanRequests.sectionTitle")}
        </Text>
        {scanRequests.map((inv) => {
          const name =
            inv.scannedBy?.fullName?.trim()
            || inv.scannedBy?.email?.trim()
            || inv.scannedBy?.phone?.trim()
            || t("collab.scanRequests.requestFromUnknown");

          return (
            <Pressable
              key={inv.id}
              onPress={() => setSelected(inv)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.92 }
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("collab.scanRequests.reviewA11y", { name })}
            >
              <View style={styles.cardIcon}>
                <Ionicons name="person-add" size={20} color={mobileColors.accent} />
              </View>
              <View style={styles.cardTexts}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {t("collab.scanRequests.requestFrom", { name })}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {t("collab.scanRequests.expires", {
                    date: new Date(inv.expiresAt).toLocaleDateString()
                  })}
                </Text>
              </View>
              <View style={styles.reviewBtn}>
                <Text style={styles.reviewBtnTxt}>
                  {t("collab.scanRequests.review")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={mobileColors.accent}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <RespondScanRequestModal
        visible={Boolean(selected)}
        invitation={selected}
        farmId={farmId}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  wrap: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  cardTexts: { flex: 1, minWidth: 0 },
  cardTitle: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  cardMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  reviewBtnTxt: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
