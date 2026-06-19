import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { VetCard } from "../sante/VetCard";
import { VetProfileModal } from "../sante/VetProfileModal";
import { useSession } from "../../context/SessionContext";
import {
  ensureDirectChatRoom,
  fetchFarm,
  searchTechnicians,
  searchVets,
  type TechnicianProfileDto,
  type VetSearchItemDto
} from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { DirectInviteModal } from "./DirectInviteModal";
import { DirectoryFiltersPanel } from "./DirectoryFiltersPanel";
import { TechnicianCard } from "./TechnicianCard";
import { TechnicianPublicProfileModal } from "./TechnicianPublicProfileModal";

type Props = {
  farmId: string;
  farmName: string;
  canManageInvites: boolean;
};

type ProfileKind = "technician" | "vet";

export function DirectoryTab({ farmId, farmName, canManageInvites }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const [kind, setKind] = useState<ProfileKind>("technician");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(100);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [experienceMin, setExperienceMin] = useState(0);
  const [specialization, setSpecialization] = useState<string | null>(null);
  const [salaryMax, setSalaryMax] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<TechnicianProfileDto | null>(
    null
  );
  const [selectedVet, setSelectedVet] = useState<VetSearchItemDto | null>(null);
  const [inviteTarget, setInviteTarget] = useState<{
    userId: string;
    name: string;
    recipientKind: "technician" | "veterinarian";
  } | null>(null);

  const farmQ = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const nearLat = farmQ.data?.latitude
    ? Number(farmQ.data.latitude)
    : undefined;
  const nearLng = farmQ.data?.longitude
    ? Number(farmQ.data.longitude)
    : undefined;

  const techQ = useQuery({
    queryKey: [
      "technicianSearch",
      farmId,
      search,
      radiusKm,
      availableOnly,
      experienceMin,
      specialization,
      salaryMax,
      nearLat,
      nearLng,
      activeProfileId
    ],
    queryFn: () =>
      searchTechnicians(
        accessToken!,
        {
          q: search,
          nearLat,
          nearLng,
          radiusKm,
          availableOnly,
          experienceMin: experienceMin > 0 ? experienceMin : undefined,
          specialization: specialization ?? undefined,
          salaryMax: salaryMax.trim()
            ? Number.parseFloat(salaryMax)
            : undefined
        },
        activeProfileId
      ),
    enabled: Boolean(accessToken && kind === "technician")
  });

  const vetQ = useQuery({
    queryKey: ["vetSearch", farmId, search, radiusKm, availableOnly, activeProfileId],
    queryFn: () =>
      searchVets(
        accessToken!,
        {
          q: search,
          lat: nearLat,
          lng: nearLng,
          available: availableOnly
        },
        activeProfileId
      ),
    enabled: Boolean(accessToken && kind === "vet")
  });

  const techItems = techQ.data?.items ?? [];
  const vetItems = vetQ.data?.items ?? [];

  const openChat = async (peerUserId: string, headline: string) => {
    try {
      const room = await ensureDirectChatRoom(
        accessToken!,
        peerUserId,
        activeProfileId
      );
      setSelectedTech(null);
      setSelectedVet(null);
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        headline,
        peerUserId,
        farmId
      });
    } catch (e) {
      Alert.alert(
        t("collab.directory.messageErrorTitle"),
        e instanceof Error ? e.message : t("common.error")
      );
    }
  };

  const listEmpty = useMemo(() => {
    if (kind === "technician" ? techQ.isPending : vetQ.isPending) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={mobileColors.accent} />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>{t("collab.directory.empty")}</Text>
        <Pressable onPress={() => setRadiusKm(2000)}>
          <Text style={styles.cta}>{t("collab.directory.expandRadius")}</Text>
        </Pressable>
      </View>
    );
  }, [kind, techQ.isPending, vetQ.isPending, t]);

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {(["technician", "vet"] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.segBtn, kind === k && styles.segBtnActive]}
            onPress={() => setKind(k)}
          >
            <Text style={[styles.segTx, kind === k && styles.segTxActive]}>
              {k === "technician"
                ? t("collab.directory.segmentTech")
                : t("collab.directory.segmentVet")}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder={
          kind === "technician"
            ? t("collab.directory.searchTech")
            : t("collab.directory.searchVet")
        }
      />

      <View style={styles.filters}>
        <Pressable
          style={styles.filterChip}
          onPress={() => setAvailableOnly((v) => !v)}
        >
          <Text style={styles.filterChipTx}>
            {availableOnly
              ? t("collab.directory.availableOnly")
              : t("collab.directory.allAvailability")}
          </Text>
        </Pressable>
        <Text style={styles.filterMeta}>
          {t("collab.directory.radius", { km: radiusKm })}
        </Text>
      </View>

      {kind === "technician" ? (
        <FlatList
          data={techItems}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={listEmpty}
          renderItem={({ item }) => (
            <TechnicianCard
              tech={item}
              onPress={() => setSelectedTech(item)}
            />
          )}
        />
      ) : (
        <FlatList
          data={vetItems}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={listEmpty}
          renderItem={({ item }) => (
            <VetCard vet={item} onPress={() => setSelectedVet(item)} />
          )}
        />
      )}

      <TechnicianPublicProfileModal
        visible={Boolean(selectedTech)}
        tech={selectedTech}
        onClose={() => setSelectedTech(null)}
        onMessage={() => {
          const tech = selectedTech;
          if (!tech) return;
          void openChat(tech.userId, tech.displayName ?? "Technicien");
        }}
        onInvite={
          canManageInvites
            ? () => {
                if (!selectedTech) return;
                setInviteTarget({
                  userId: selectedTech.userId,
                  name: selectedTech.displayName ?? "Technicien",
                  recipientKind: "technician"
                });
                setSelectedTech(null);
              }
            : undefined
        }
      />

      <VetProfileModal
        visible={Boolean(selectedVet)}
        vetId={selectedVet?.id ?? null}
        farmId={farmId}
        farmName={farmName}
        accessToken={accessToken ?? ""}
        activeProfileId={activeProfileId}
        variant="collaboration"
        onClose={() => setSelectedVet(null)}
        onPlanVisit={() => {
          const vet = selectedVet;
          setSelectedVet(null);
          if (vet) {
            navigation.navigate("ProducerScheduleVetVisit", {
              farmId,
              farmName,
              vetProfileId: vet.id
            });
          }
        }}
        onOpenChat={(roomId, headline, peerUserId) => {
          setSelectedVet(null);
          navigation.navigate("ChatRoom", {
            roomId,
            headline,
            farmId,
            peerUserId
          });
        }}
        onInvite={
          canManageInvites
            ? (userId, name) => {
                setInviteTarget({
                  userId,
                  name,
                  recipientKind: "veterinarian"
                });
                setSelectedVet(null);
              }
            : undefined
        }
      />

      {canManageInvites && inviteTarget ? (
        <DirectInviteModal
          visible
          farmId={farmId}
          farmName={farmName}
          peerUserId={inviteTarget.userId}
          peerDisplayName={inviteTarget.name}
          recipientKind={inviteTarget.recipientKind}
          onClose={() => setInviteTarget(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 320 },
  segment: {
    flexDirection: "row",
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.pill,
    padding: 4,
    marginBottom: mobileSpacing.sm
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    alignItems: "center"
  },
  segBtnActive: { backgroundColor: mobileColors.background },
  segTx: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  segTxActive: { fontWeight: "700", color: mobileColors.textPrimary },
  search: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: mobileSpacing.sm,
    backgroundColor: mobileColors.background
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.sm
  },
  filterChip: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  filterChipTx: { fontSize: 12, fontWeight: "600", color: mobileColors.accent },
  filterIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  filterIconTx: { fontSize: 18 },
  filterMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    flex: 1,
    textAlign: "right"
  },
  centered: { padding: 32, alignItems: "center" },
  empty: { textAlign: "center", color: mobileColors.textSecondary },
  cta: {
    marginTop: 12,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
