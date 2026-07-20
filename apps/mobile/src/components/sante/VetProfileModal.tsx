import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { openPhoneCall } from "../../lib/phone";
import { ensureDirectChatRoom, fetchVetPublicProfile } from "../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

type Props = {
  visible: boolean;
  vetId: string | null;
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId?: string | null;
  /** Santé : appel + message si vérifié. Collaboration : message toujours proposé. */
  variant?: "health" | "collaboration";
  onClose: () => void;
  onPlanVisit: () => void;
  onOpenChat: (roomId: string, headline: string, peerUserId: string) => void;
  onInvite?: (peerUserId: string, displayName: string) => void;
};

export function VetProfileModal({
  visible,
  vetId,
  farmId,
  farmName,
  accessToken,
  activeProfileId,
  variant = "health",
  onClose,
  onPlanVisit,
  onOpenChat,
  onInvite
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isCollaboration = variant === "collaboration";

  const q = useQuery({
    queryKey: ["vetPublicProfile", vetId, activeProfileId],
    queryFn: () => fetchVetPublicProfile(accessToken, vetId!, activeProfileId),
    enabled: Boolean(visible && vetId && accessToken)
  });

  const profile = q.data;

  const chatMutation = useMutation({
    mutationFn: () =>
      ensureDirectChatRoom(accessToken, profile!.userId, activeProfileId),
    onSuccess: (room) => {
      if (!profile?.userId) {
        return;
      }
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
      onClose();
      onOpenChat(room.id, profile.fullName ?? "Vétérinaire", profile.userId);
    },
    onError: (err: Error) => {
      Alert.alert(t("common.error"), getUserFacingError(err, t));
    }
  });

  const onCall = () => {
    void openPhoneCall(profile?.professionalPhone, {
      errorTitle: t("health.vetSearch.callErrorTitle"),
      errorMessage: t("health.vetSearch.callError")
    });
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={profile?.fullName ?? t("health.vetSearch.profileTitle")}
      sheetMaxHeight="92%"
      footerPrimary={
        profile && !profile.isSelf ? (
          <View style={styles.actions}>
            {isCollaboration ? (
              <>
                <Pressable
                  style={styles.btnPrimary}
                  onPress={() => chatMutation.mutate()}
                  disabled={chatMutation.isPending}
                >
                  {chatMutation.isPending ? (
                    <ActivityIndicator size="small" color={mobileColors.onAccent} />
                  ) : (
                    <Text style={styles.btnPrimaryTx}>
                      {t("collab.directory.message")}
                    </Text>
                  )}
                </Pressable>
                {onInvite ? (
                  <Pressable
                    style={styles.btnSecondary}
                    onPress={() => {
                      onInvite(profile.userId, profile.fullName);
                      onClose();
                    }}
                  >
                    <Text style={styles.btnSecondaryTx}>
                      {t("collab.directory.invite")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.btnSecondary} onPress={onPlanVisit}>
                  <Text style={styles.btnSecondaryTx}>
                    📅 {t("health.vetSearch.planVisit")}
                  </Text>
                </Pressable>
                {profile.canContact ? (
                  <Pressable style={styles.btnSecondary} onPress={onCall}>
                    <Text style={styles.btnSecondaryTx}>
                      📞 {t("health.vetSearch.call")}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <Pressable style={styles.btnSecondary} onPress={onPlanVisit}>
                  <Text style={styles.btnSecondaryTx}>
                    📅 {t("health.vetSearch.planVisit")}
                  </Text>
                </Pressable>
                {profile.canContact ? (
                  <View style={styles.contactRow}>
                    <Pressable
                      style={[styles.btnPrimary, styles.btnHalf]}
                      onPress={onCall}
                    >
                      <Text style={styles.btnPrimaryTx}>
                        📞 {t("health.vetSearch.call")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnSecondary, styles.btnHalf]}
                      onPress={() => chatMutation.mutate()}
                      disabled={chatMutation.isPending}
                    >
                      {chatMutation.isPending ? (
                        <ActivityIndicator
                          size="small"
                          color={mobileColors.accent}
                        />
                      ) : (
                        <Text style={styles.btnSecondaryTx}>
                          💬 {t("health.vetSearch.message")}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : undefined
      }
    >
      {q.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : q.error ? (
        <Text style={styles.err}>{(q.error as Error).message}</Text>
      ) : profile ? (
        <View style={styles.body}>
          <View style={styles.badgeRow}>
            {profile.isVerified ? (
              <Text style={styles.verified}>{t("health.vetSearch.verified")}</Text>
            ) : (
              <Text style={styles.pending}>{t("health.vetSearch.notVerified")}</Text>
            )}
            <Text
              style={[
                styles.availability,
                profile.availability
                  ? styles.availabilityOn
                  : styles.availabilityOff
              ]}
            >
              {profile.availability
                ? t("health.vetSearch.available")
                : t("health.vetSearch.unavailable")}
            </Text>
          </View>
          <Text style={styles.meta}>{profile.primarySpecialty}</Text>
          {profile.otherSpecialties?.length ? (
            <Text style={styles.meta}>
              {t("health.vetSearch.otherSpecialties", {
                list: profile.otherSpecialties.join(", ")
              })}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {profile.schoolName} ({profile.schoolCountry}) · {profile.graduationYear}
          </Text>
          <Text style={styles.meta}>{profile.locationLabel}</Text>
          {profile.interventionRadiusKm != null ? (
            <Text style={styles.meta}>
              {t("health.vetSearch.radiusKm", {
                km: profile.interventionRadiusKm
              })}
            </Text>
          ) : null}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <Text style={styles.meta}>
            {profile.ratingAvg != null
              ? `⭐ ${profile.ratingAvg.toFixed(1)} / 5 · ${profile.ratingCount} ${t("health.vetSearch.reviews")}`
              : t("collab.directory.noRatings")}
          </Text>
          <Text style={styles.visits}>
            {t("health.vetSearch.completedAppointments", {
              count:
                profile.stats.completedAppointments ??
                profile.stats.visitsCompleted
            })}
          </Text>
          {profile.servicePriceRange ? (
            <Text style={styles.meta}>
              {t("health.vetSearch.priceRange", {
                min: Math.round(profile.servicePriceRange.min).toLocaleString(
                  "fr-FR"
                ),
                max: Math.round(profile.servicePriceRange.max).toLocaleString(
                  "fr-FR"
                ),
                currency: profile.servicePriceRange.currency
              })}
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {t("health.vetSearch.statsFarms", {
              count: profile.stats.farmsFollowed
            })}
          </Text>
          {profile.recentReviews.length > 0 ? (
            <View style={styles.reviews}>
              {profile.recentReviews.slice(0, 3).map((r, i) => (
                <View key={`${r.createdAt}-${i}`} style={styles.reviewRow}>
                  <Text style={styles.reviewScore}>
                    {"★".repeat(r.score)}
                    {"☆".repeat(Math.max(0, 5 - r.score))}
                  </Text>
                  {r.comment ? (
                    <Text style={styles.reviewComment} numberOfLines={2}>
                      {r.comment}
                    </Text>
                  ) : null}
                  {r.tags && r.tags.length > 0 ? (
                    <Text style={styles.reviewTags}>{r.tags.join(" · ")}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.sm },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  verified: { color: "#059669", fontWeight: "700" },
  pending: { color: mobileColors.textSecondary },
  availability: { fontWeight: "700", fontSize: 13 },
  availabilityOn: { color: "#059669" },
  availabilityOff: { color: mobileColors.textSecondary },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  visits: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  bio: { ...mobileTypography.body, color: mobileColors.textPrimary },
  err: { color: mobileColors.error },
  reviews: { marginTop: mobileSpacing.sm, gap: mobileSpacing.sm },
  reviewRow: { gap: 2 },
  reviewScore: { color: "#F59E0B", fontWeight: "700", fontSize: 14 },
  reviewComment: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  reviewTags: { ...mobileTypography.meta, fontSize: 11, color: mobileColors.textSecondary },
  actions: { gap: mobileSpacing.sm },
  contactRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  btnHalf: { flex: 1 },
  btnPrimary: {
    backgroundColor: mobileColors.accent,
    padding: mobileSpacing.md,
    borderRadius: 12,
    alignItems: "center"
  },
  btnPrimaryTx: { color: mobileColors.onAccent, fontWeight: "700" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    padding: mobileSpacing.md,
    borderRadius: 12,
    alignItems: "center"
  },
  btnSecondaryTx: { color: mobileColors.accent, fontWeight: "700" }
});
