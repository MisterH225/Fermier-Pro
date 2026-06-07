import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import type { FarmMemberDto } from "../../lib/api";
import { fetchFarmMembers } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { InviteModal } from "./InviteModal";
import { MemberCard } from "./MemberCard";
import { MemberModal } from "./MemberModal";

type Props = {
  farmId: string;
  farmName: string | null;
};

export function MembersList({ farmId, farmName }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FarmMemberDto | null>(
    null
  );

  const membersQ = useQuery({
    queryKey: ["farmMembers", farmId, activeProfileId],
    queryFn: () => fetchFarmMembers(accessToken, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const members = membersQ.data ?? [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t("collab.membersTitle")}
          {membersQ.data ? ` (${members.length})` : ""}
        </Text>
        <Pressable
          onPress={() => setInviteVisible(true)}
          style={styles.addBtn}
          accessibilityRole="button"
        >
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.addBtnTxt}>{t("collab.addMember")}</Text>
        </Pressable>
      </View>

      {membersQ.isLoading ? (
        <ActivityIndicator
          color={mobileColors.accent}
          style={styles.loader}
        />
      ) : membersQ.error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorTxt}>{t("collab.loadError")}</Text>
          <Pressable
            onPress={() => void membersQ.refetch()}
            style={styles.retryBtn}
          >
            <Text style={styles.retryTxt}>{t("collab.retry")}</Text>
          </Pressable>
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="people-outline"
            size={20}
            color={mobileColors.textSecondary}
          />
          <Text style={styles.emptyTxt}>{t("collab.noMembers")}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onPress={() => setSelectedMember(m)}
            />
          ))}
        </View>
      )}

      <InviteModal
        visible={inviteVisible}
        farmId={farmId}
        farmName={farmName}
        onClose={() => setInviteVisible(false)}
      />

      <MemberModal
        visible={Boolean(selectedMember)}
        member={selectedMember}
        farmId={farmId}
        onClose={() => setSelectedMember(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.md
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill
  },
  addBtnTxt: {
    ...mobileTypography.meta,
    color: "#fff",
    fontWeight: "700"
  },
  loader: {
    marginVertical: mobileSpacing.xl
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  errorTxt: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    flex: 1
  },
  retryBtn: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.accent
  },
  retryTxt: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md
  },
  emptyTxt: {
    flex: 1,
    ...mobileTypography.body,
    fontSize: 13,
    color: mobileColors.textSecondary
  },
  list: {
    gap: mobileSpacing.sm
  }
});
