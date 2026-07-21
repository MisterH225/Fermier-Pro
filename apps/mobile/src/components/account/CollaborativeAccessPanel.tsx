import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSession } from "../../context/SessionContext";
import {
  buildInvitationShareUrl,
  fetchFarmDefaultInvitation
} from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { InviteModal as CollaborativeAccessShareModal } from "../collaboration/InviteModal";

type Props = {
  farmId: string | null;
  farmName: string | null;
};

const QR_SIZE = 188;

export function CollaborativeAccessPanel({ farmId, farmName }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const defaultInvitationQuery = useQuery({
    queryKey: ["farmDefaultInvitation", farmId, activeProfileId],
    queryFn: () => fetchFarmDefaultInvitation(accessToken, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const shareUrl = useMemo(() => {
    const token = defaultInvitationQuery.data?.token;
    return token ? buildInvitationShareUrl(token) : null;
  }, [defaultInvitationQuery.data?.token]);

  const copy = async () => {
    if (!shareUrl) {
      return;
    }
    await Clipboard.setStringAsync(shareUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1800);
  };

  const share = async () => {
    if (!shareUrl) {
      return;
    }
    const message = t("collab.shareMessage", {
      farm: farmName ?? "",
      url: shareUrl
    });
    await Share.share({ message, url: shareUrl });
  };

  const refresh = () => {
    if (!farmId) {
      return;
    }
    void qc.invalidateQueries({
      queryKey: ["farmDefaultInvitation", farmId, activeProfileId]
    });
  };

  if (!farmId) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons
          name="people-outline"
          size={20}
          color={mobileColors.textSecondary}
        />
        <Text style={styles.emptyTxt}>{t("collab.noFarm")}</Text>
      </View>
    );
  }

  const loading = defaultInvitationQuery.isLoading;
  const error = defaultInvitationQuery.error;

  return (
    <View style={styles.wrap}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t("collab.defaultQrInfoTitle")}</Text>
        <Text style={styles.infoBody}>{t("collab.defaultQrInfoBody")}</Text>
      </View>

      <View style={styles.qrShell}>
        {loading ? (
          <View style={styles.qrLoader}>
            <ActivityIndicator color={mobileColors.accent} />
          </View>
        ) : error ? (
          <View style={styles.qrLoader}>
            <Ionicons
              name="alert-circle-outline"
              size={36}
              color={mobileColors.error}
            />
            <Text style={styles.errorTxt}>{t("collab.loadError")}</Text>
            <Pressable
              onPress={refresh}
              hitSlop={10}
              style={styles.retryBtn}
              accessibilityRole="button"
            >
              <Text style={styles.retryTxt}>{t("collab.retry")}</Text>
            </Pressable>
          </View>
        ) : shareUrl ? (
          <View style={styles.qrCard}>
            <QRCode
              value={shareUrl}
              size={QR_SIZE}
              backgroundColor={mobileColors.background}
              color={mobileColors.textPrimary}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.hint}>{t("collab.scanHint")}</Text>

      {shareUrl ? (
        <View style={styles.linkCard}>
          <Ionicons
            name="link-outline"
            size={18}
            color={mobileColors.textSecondary}
            style={styles.linkIcon}
          />
          <Text style={styles.linkText} numberOfLines={1}>
            {shareUrl}
          </Text>
          <Pressable
            onPress={() => void copy()}
            style={styles.copyBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("collab.copyLink")}
          >
            <Ionicons
              name={copyFeedback ? "checkmark-circle" : "copy-outline"}
              size={20}
              color={
                copyFeedback ? mobileColors.accent : mobileColors.textSecondary
              }
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <Pressable
          onPress={() => void share()}
          style={[styles.cta, styles.ctaSecondary]}
          disabled={!shareUrl}
          accessibilityRole="button"
        >
          <Ionicons
            name="share-social-outline"
            size={18}
            color={mobileColors.textPrimary}
          />
          <Text style={styles.ctaSecondaryTxt}>{t("collab.shareDefault")}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!farmId) {
              return;
            }
            setShareModalVisible(true);
          }}
          style={[styles.cta, styles.ctaPrimary]}
          accessibilityRole="button"
        >
          <Ionicons name="person-add-outline" size={18} color={mobileColors.onAccent} />
          <Text style={styles.ctaPrimaryTxt}>{t("collab.openShareModal")}</Text>
        </Pressable>
      </View>

      <Text style={styles.subHint}>{t("collab.scopedInviteInfoBody")}</Text>

      <CollaborativeAccessShareModal
        visible={shareModalVisible}
        farmId={farmId}
        farmName={farmName}
        onClose={() => setShareModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingVertical: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.md,
    gap: mobileSpacing.md
  },
  infoBox: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: 4
  },
  infoTitle: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  infoBody: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.sm,
    lineHeight: 18,
    color: mobileColors.textSecondary
  },
  qrShell: {
    alignItems: "center"
  },
  qrCard: {
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  qrLoader: {
    width: QR_SIZE + 28,
    height: QR_SIZE + 28,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  linkIcon: {
    marginRight: 2
  },
  linkText: {
    flex: 1,
    ...mobileTypography.body,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary
  },
  copyBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  ctaRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  cta: {
    flex: 1,
    minHeight: 46,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: mobileSpacing.md
  },
  ctaSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  ctaSecondaryTxt: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  ctaPrimary: {
    backgroundColor: mobileColors.accent
  },
  ctaPrimaryTxt: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: mobileColors.onAccent
  },
  subHint: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.md
  },
  emptyTxt: {
    flex: 1,
    ...mobileTypography.body,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  },
  errorTxt: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  retryBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent
  },
  retryTxt: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
