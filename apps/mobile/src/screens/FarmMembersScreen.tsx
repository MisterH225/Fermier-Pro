import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileColors } from "../theme/mobileTheme";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useScreenTitle } from "../hooks/useScreenTitle";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import type { FarmInvitationPendingDto, FarmMemberDto } from "../lib/api";
import {
  fetchFarmMembers,
  fetchFarmPendingInvitations,
  removeFarmMember
} from "../lib/api";
import { hasFarmScope } from "../lib/menuVisibility";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "FarmMembers">;

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  worker: "Technicien",
  veterinarian: "Vétérinaire",
  viewer: "Lecture seule"
};

export function FarmMembersScreen({ route, navigation }: Props) {
  const { farmId, farmName, effectiveScopes } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const myId = authMe?.user.id;

  const canInvite = hasFarmScope(effectiveScopes, "invitations.manage");

  const membersQ = useQuery({
    queryKey: ["farmMembers", farmId, activeProfileId],
    queryFn: () => fetchFarmMembers(accessToken, farmId, activeProfileId)
  });

  const invitesQ = useQuery({
    queryKey: ["farmPendingInvitations", farmId, activeProfileId],
    queryFn: () => fetchFarmPendingInvitations(accessToken, farmId, activeProfileId),
    enabled: canInvite
  });

  const removeMut = useMutation({
    mutationFn: (membershipId: string) =>
      removeFarmMember(accessToken, farmId, membershipId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmMembers", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmPendingInvitations", farmId] });
    },
    onError: (e: Error) => Alert.alert("Impossible", getUserFacingError(e, t))
  });

  useScreenTitle(navigation, t("navigation.screenTitles.team"), {
    headerRight: canInvite
      ? () => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("CreateFarmInvitation", {
                farmId,
                farmName
              })
            }
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnText}>Inviter</Text>
          </TouchableOpacity>
        )
      : undefined
  });

  if (membersQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  const err =
    membersQ.error instanceof Error
      ? getUserFacingError(membersQ.error, t)
      : membersQ.error
        ? String(membersQ.error)
        : null;

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
      </View>
    );
  }

  const members = membersQ.data ?? [];

  return (
    <View style={styles.flex}>
      {canInvite && invitesQ.data && invitesQ.data.length > 0 ? (
        <View style={styles.inviteBanner}>
          <Text style={styles.inviteTitle}>Invitations en attente</Text>
          {invitesQ.data.map((inv: FarmInvitationPendingDto) => (
            <Text key={inv.id} style={styles.inviteLine}>
              {inv.kind === "scan_request"
                ? `Demande${
                    inv.scannedBy?.fullName
                      ? ` de ${inv.scannedBy.fullName}`
                      : ""
                  }`
                : inv.role
                  ? (ROLE_LABEL[inv.role] ?? inv.role)
                  : "Lien collaboratif"}
              {inv.inviteeEmail ? ` · ${inv.inviteeEmail}` : ""}
              {inv.inviteePhone ? ` · ${inv.inviteePhone}` : ""}
              {" · expire "}
              {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
            </Text>
          ))}
        </View>
      ) : null}
      <FlatList
        data={members}
        keyExtractor={(m: FarmMemberDto) => m.id}
        contentContainerStyle={styles.listContent}
        refreshing={membersQ.isFetching}
        onRefresh={() => void membersQ.refetch()}
        renderItem={({ item: m }: { item: FarmMemberDto }) => {
          const isSelf = myId === m.userId;
          const canRemoveOther =
            canInvite && !isSelf && m.role !== "owner";
          const canLeaveSelf = isSelf && m.role !== "owner";
          return (
            <View style={styles.card}>
              <Text style={styles.name}>
                {m.user.fullName?.trim() || m.user.email || m.userId}
              </Text>
              <Text style={styles.meta}>
                {ROLE_LABEL[m.role] ?? m.role}
                {m.user.email ? ` · ${m.user.email}` : ""}
              </Text>
              {canRemoveOther || canLeaveSelf ? (
                <TouchableOpacity
                  style={styles.dangerBtn}
                  disabled={removeMut.isPending}
                  onPress={() =>
                    Alert.alert(
                      canLeaveSelf ? "Quitter cette ferme ?" : "Retirer ce membre ?",
                      canLeaveSelf
                        ? "Tu perdras l’accès à cette exploitation."
                        : "Le membre ne pourra plus accéder à la ferme.",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: canLeaveSelf ? "Quitter" : "Retirer",
                          style: "destructive",
                          onPress: () => removeMut.mutate(m.id)
                        }
                      ]
                    )
                  }
                >
                  <Text style={styles.dangerTxt}>
                    {canLeaveSelf ? "Quitter la ferme" : "Retirer"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.canvas
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 14,
    color: mobileColors.textSecondary
  },
  inviteBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#eef6d8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c5d99a"
  },
  inviteTitle: { fontWeight: "700", marginBottom: 6, color: mobileColors.textPrimary },
  inviteLine: { fontSize: 13, color: "#4a5238", marginBottom: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8e6d8"
  },
  name: { fontSize: 16, fontWeight: "700", color: mobileColors.textPrimary },
  meta: { fontSize: 14, color: mobileColors.textSecondary, marginTop: 4 },
  dangerBtn: { marginTop: 10, alignSelf: "flex-start" },
  dangerTxt: { color: "#b42318", fontWeight: "600", fontSize: 14 },
  error: { color: "#b42318", padding: 16 },
  headerBtn: { marginRight: 8 },
  headerBtnText: { color: mobileColors.accent, fontWeight: "600", fontSize: 15 }
});
