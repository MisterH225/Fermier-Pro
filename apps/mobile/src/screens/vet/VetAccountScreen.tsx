import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { AccountSettingsPanel } from "../../components/account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../../components/account/ActiveProfileSwitcherControl";
import {
  ProfileCompletionGauge,
  SectionHeader,
  vetPalette
} from "../../components/common";
import { VetMobileShell } from "../../components/layout";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { fetchVetProfileMe, patchVetPublicProfile } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  vetProfileCompletionPercent,
  vetProfileNextEmptyField,
  type VetProfileFieldKey
} from "../../lib/vetProfileCompletion";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const AVATAR = 54;

type EditModalKey =
  | "bio"
  | "specialty"
  | "city"
  | "radius"
  | "others"
  | null;

function PrefRow({
  label,
  value,
  empty,
  actionLabel,
  onEdit,
  trailing
}: {
  label: string;
  value?: string;
  empty?: boolean;
  actionLabel?: string;
  onEdit?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.frow}>
      <Text style={styles.frowLabel}>{label}</Text>
      {trailing ?? (
        <>
          <Text
            style={[styles.frowValue, empty && styles.frowValueEmpty]}
            numberOfLines={2}
          >
            {value}
          </Text>
          {onEdit && actionLabel ? (
            <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
              <Text style={styles.frowEdit}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

function withDoctorPrefix(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (/^dr\.?\s/i.test(trimmed)) return trimmed;
  return `Dr. ${trimmed}`;
}

export function VetAccountScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const [editModal, setEditModal] = useState<EditModalKey>(null);

  const profileQ = useQuery({
    queryKey: ["vetProfileMe", activeProfileId],
    queryFn: () => fetchVetProfileMe(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const vet = profileQ.data;

  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [others, setOthers] = useState("");
  const [city, setCity] = useState("");
  const [radiusKm, setRadiusKm] = useState("");
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!vet) return;
    setBio(vet.bio ?? "");
    setSpecialty(vet.primarySpecialty ?? "");
    setOthers((vet.otherSpecialties ?? []).join(", "));
    setCity(
      vet.locationCity?.trim() ||
        vet.locationLabel?.split(",")[0]?.trim() ||
        ""
    );
    setRadiusKm(
      vet.interventionRadiusKm != null ? String(vet.interventionRadiusKm) : ""
    );
    setAvailable(vet.availability);
  }, [vet, editModal]);

  const avatarUri = useMemo(
    () =>
      resolveActiveProfileAvatarUrl(authMe, activeProfileId) ??
      vet?.profilePhotoUrl ??
      null,
    [authMe, activeProfileId, vet?.profilePhotoUrl]
  );

  const displayName = withDoctorPrefix(
    vet?.fullName ?? authMe?.user.fullName ?? "—"
  );

  const completion = useMemo(
    () => vetProfileCompletionPercent(vet),
    [vet]
  );
  const nextField = useMemo(() => vetProfileNextEmptyField(vet), [vet]);

  const nextFieldHint = useMemo(() => {
    if (!nextField) return null;
    const map: Record<VetProfileFieldKey, string> = {
      bio: t("vet.account.nextField.bio"),
      otherSpecialties: t("vet.account.nextField.otherSpecialties"),
      interventionRadiusKm: t("vet.account.nextField.interventionRadiusKm"),
      profilePhotoUrl: t("vet.account.nextField.profilePhotoUrl"),
      availability: t("vet.account.nextField.availability")
    };
    return map[nextField];
  }, [nextField, t]);

  const isPending = vet?.verificationStatus === "pending";
  const isRejected = vet?.verificationStatus === "rejected";
  const isVerified = vet?.isVerified === true;

  const verificationLabel = isVerified
    ? t("vet.account.verified")
    : isRejected
      ? t("vet.account.rejected")
      : t("vet.account.pending");

  const headerSubtitle = useMemo(() => {
    const order = vet?.orderNumber
      ? t("vet.account.orderNumberShort", { n: vet.orderNumber })
      : null;
    return [order, verificationLabel].filter(Boolean).join(" · ");
  }, [vet?.orderNumber, verificationLabel, t]);

  const saveMut = useMutation({
    mutationFn: (body: Parameters<typeof patchVetPublicProfile>[1]) =>
      patchVetPublicProfile(accessToken!, body, activeProfileId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vetProfileMe"] });
      await qc.invalidateQueries({ queryKey: ["vetDashboard"] });
      setEditModal(null);
    },
    onError: (e: Error) =>
      Alert.alert(t("vet.account.errorTitle"), getUserFacingError(e, t))
  });

  const saveCurrentModal = () => {
    if (editModal === "bio") {
      saveMut.mutate({ bio: bio.trim() });
      return;
    }
    if (editModal === "specialty") {
      saveMut.mutate({ primarySpecialty: specialty.trim() || undefined });
      return;
    }
    if (editModal === "others") {
      const list = others
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      saveMut.mutate({ otherSpecialties: list });
      return;
    }
    if (editModal === "city") {
      saveMut.mutate({ locationCity: city.trim() || undefined });
      return;
    }
    if (editModal === "radius") {
      const radius = radiusKm.trim() ? Number(radiusKm) : undefined;
      saveMut.mutate({
        interventionRadiusKm: Number.isFinite(radius) ? radius : undefined
      });
    }
  };

  const toggleAvailability = (next: boolean) => {
    setAvailable(next);
    saveMut.mutate({ availability: next });
  };

  const openNextField = () => {
    if (!nextField) return;
    if (nextField === "bio") setEditModal("bio");
    else if (nextField === "otherSpecialties") setEditModal("others");
    else if (nextField === "interventionRadiusKm") setEditModal("radius");
    else if (nextField === "availability") {
      /* toggle visible in vitrine */
    }
  };

  const ratingDisplay =
    vet?.ratingAvg != null ? vet.ratingAvg.toFixed(1) : "—";
  const cancellations = vet?.cancelledAppointmentsAsVet ?? 0;
  const completed =
    vet?.stats.completedAppointments ?? vet?.stats.visitsCompleted ?? 0;

  const verifiedAtLabel = vet?.verifiedAt
    ? new Date(vet.verifiedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : null;

  const bioDisplay = vet?.bio?.trim() || t("vet.account.toComplete");
  const specialtyDisplay =
    vet?.primarySpecialty?.trim() || t("vet.account.toComplete");
  const othersDisplay = vet?.otherSpecialties?.length
    ? vet.otherSpecialties.join(", ")
    : t("vet.account.toComplete");
  const cityDisplay =
    vet?.locationCity?.trim() ||
    vet?.locationLabel?.split(",")[0]?.trim() ||
    t("vet.account.toComplete");
  const radiusDisplay =
    vet?.interventionRadiusKm != null
      ? t("vet.account.radiusValue", { km: vet.interventionRadiusKm })
      : t("vet.account.toComplete");

  const modalTitle =
    editModal === "bio"
      ? t("vet.account.bio")
      : editModal === "specialty"
        ? t("vet.account.specialty")
        : editModal === "others"
          ? t("vet.account.otherSpecialties")
          : editModal === "city"
            ? t("vet.account.city")
            : editModal === "radius"
              ? t("vet.account.radius")
              : "";

  if (profileQ.isLoading && !vet) {
    return (
      <VetMobileShell hideTopBar>
        <View style={styles.loader}>
          <ActivityIndicator color={vetColors.primary} />
        </View>
      </VetMobileShell>
    );
  }

  return (
    <VetMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {isPending ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingTitle}>
              {t("vet.account.pendingBannerTitle")}
            </Text>
            <Text style={styles.pendingBody}>
              {t("vet.account.pendingBannerBody")}
            </Text>
          </View>
        ) : null}
        {isRejected ? (
          <View style={[styles.pendingBanner, styles.rejectedBanner]}>
            <Text style={styles.pendingTitle}>
              {t("vet.account.rejectedBannerTitle")}
            </Text>
            <Text style={styles.pendingBody}>
              {t("vet.account.rejectedBannerBody")}
            </Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.who}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]}>
                  <Ionicons
                    name="medical"
                    size={22}
                    color={vetColors.primary}
                  />
                </View>
              )}
              {isVerified ? (
                <View style={styles.vbadge}>
                  <Ionicons
                    name="checkmark"
                    size={10}
                    color={vetColors.onPrimary}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.hi}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.subtitle}>{headerSubtitle}</Text>
            </View>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setEditModal("bio")}
            accessibilityRole="button"
            accessibilityLabel={t("vet.account.editPublic")}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={vetColors.textPrimary}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={nextField ? openNextField : undefined}
          disabled={!nextField}
        >
          <ProfileCompletionGauge
            percent={completion}
            palette={vetPalette}
            label={t("vet.account.completionLabel")}
            hint={nextFieldHint}
          />
        </Pressable>

        <View style={[styles.card, styles.reputationCard]}>
          <View style={styles.repRow}>
            <Text style={styles.repTitle}>{t("vet.account.sectionReputation")}</Text>
            <Text style={styles.stars}>
              ★★★★★{" "}
              <Text style={styles.ratingNum}>{ratingDisplay}</Text>
            </Text>
          </View>
          <Text style={styles.repMeta}>
            {t("vet.account.reputationMeta", {
              reviews: vet?.ratingCount ?? 0,
              visits: completed,
              cancellations:
                cancellations === 0
                  ? t("vet.account.zeroCancellations")
                  : t("vet.account.cancellationsCount", {
                      count: cancellations
                    })
            })}
          </Text>
        </View>

        <SectionHeader
          label={t("vet.account.sectionShowcase")}
          palette={vetPalette}
        />
        <View style={styles.card}>
          <PrefRow
            label={t("vet.account.specialty")}
            value={specialtyDisplay}
            empty={!vet?.primarySpecialty?.trim()}
            actionLabel={
              vet?.primarySpecialty?.trim()
                ? t("vet.account.edit")
                : t("vet.account.add")
            }
            onEdit={() => setEditModal("specialty")}
          />
          <PrefRow
            label={t("vet.account.otherSpecialties")}
            value={othersDisplay}
            empty={!vet?.otherSpecialties?.length}
            actionLabel={
              vet?.otherSpecialties?.length
                ? t("vet.account.edit")
                : t("vet.account.add")
            }
            onEdit={() => setEditModal("others")}
          />
          <PrefRow
            label={t("vet.account.zone")}
            value={
              vet?.interventionRadiusKm != null
                ? t("vet.account.zoneValue", {
                    city: cityDisplay,
                    km: vet.interventionRadiusKm
                  })
                : cityDisplay
            }
            empty={
              !vet?.locationCity?.trim() &&
              !vet?.locationLabel?.trim() &&
              vet?.interventionRadiusKm == null
            }
            actionLabel={t("vet.account.edit")}
            onEdit={() => setEditModal("city")}
          />
          <PrefRow
            label={t("vet.account.radius")}
            value={radiusDisplay}
            empty={vet?.interventionRadiusKm == null}
            actionLabel={
              vet?.interventionRadiusKm != null
                ? t("vet.account.edit")
                : t("vet.account.add")
            }
            onEdit={() => setEditModal("radius")}
          />
          <PrefRow
            label={t("vet.account.bio")}
            value={bioDisplay}
            empty={!vet?.bio?.trim()}
            actionLabel={
              vet?.bio?.trim() ? t("vet.account.edit") : t("vet.account.add")
            }
            onEdit={() => setEditModal("bio")}
          />
          <PrefRow
            label={t("vet.account.availability")}
            trailing={
              <Switch
                value={available}
                onValueChange={toggleAvailability}
                disabled={saveMut.isPending}
                trackColor={{
                  false: vetColors.border,
                  true: vetColors.success
                }}
                thumbColor={vetColors.cardBg}
              />
            }
          />
        </View>

        <SectionHeader
          label={t("vet.account.sectionDiploma")}
          palette={vetPalette}
        />
        <View style={styles.card}>
          <PrefRow
            label={t("vet.account.school")}
            value={
              vet
                ? `${vet.schoolName} · ${vet.graduationYear}`
                : "—"
            }
          />
          <PrefRow
            label={t("vet.account.verifiedAt")}
            value={verifiedAtLabel ?? "—"}
            empty={!verifiedAtLabel}
          />
          <Text style={styles.readonlyHint}>
            {t("vet.account.diplomaReadonly")}
          </Text>
        </View>

        <SectionHeader
          label={t("vet.account.sectionSettings")}
          palette={vetPalette}
        />
        <View style={styles.card}>
          <PrefRow
            label={t("vet.account.walletRow")}
            value={t("vet.account.openWallet")}
            actionLabel={t("vet.account.openShort")}
            onEdit={() => navigation.navigate("UserWallet")}
          />
          <View style={styles.switcherWrap}>
            <ActiveProfileSwitcherControl variant="default" />
          </View>
          <AccountSettingsPanel
            compact
            hideLanguagePicker={false}
            hideActiveProfileSwitcher
          />
        </View>
      </ScrollView>

      <Modal
        visible={editModal != null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setEditModal(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                Keyboard.dismiss();
                setEditModal(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {modalTitle}
                </Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditModal(null);
                  }}
                  hitSlop={12}
                  style={styles.modalCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.cancel")}
                  testID="vet-pref-modal-close"
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={vetColors.textPrimary}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
              >
                {editModal === "bio" ? (
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    multiline
                    value={bio}
                    onChangeText={setBio}
                    placeholder={t("vet.account.bioPh")}
                    placeholderTextColor={vetColors.textMuted}
                  />
                ) : null}
                {editModal === "specialty" ? (
                  <TextInput
                    style={styles.input}
                    value={specialty}
                    onChangeText={setSpecialty}
                  />
                ) : null}
                {editModal === "others" ? (
                  <TextInput
                    style={styles.input}
                    value={others}
                    onChangeText={setOthers}
                    placeholder={t("vet.account.otherSpecialtiesPh")}
                    placeholderTextColor={vetColors.textMuted}
                  />
                ) : null}
                {editModal === "city" ? (
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                  />
                ) : null}
                {editModal === "radius" ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={radiusKm}
                    onChangeText={setRadiusKm}
                    placeholder={t("vet.account.radiusPh")}
                    placeholderTextColor={vetColors.textMuted}
                  />
                ) : null}
              </ScrollView>
              <View style={[styles.saveRow, { paddingBottom: bottomInset }]}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditModal(null);
                  }}
                >
                  <Text style={styles.cancelTx}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={styles.saveBtn}
                  onPress={saveCurrentModal}
                  disabled={saveMut.isPending}
                >
                  {saveMut.isPending ? (
                    <ActivityIndicator color={vetColors.onPrimary} />
                  ) : (
                    <Text style={styles.saveTx}>{t("common.save")}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  pendingBanner: {
    backgroundColor: vetColors.kpiAmber,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: 4
  },
  rejectedBanner: { backgroundColor: vetColors.kpiRose },
  pendingTitle: {
    fontWeight: "700",
    color: vetColors.textPrimary,
    fontSize: 14
  },
  pendingBody: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.sm
  },
  who: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  hi: { flex: 1, gap: 2 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2
  },
  avatarPh: {
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  vbadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: vetColors.success,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: vetColors.cardBg
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  subtitle: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: vetColors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    ...vetShadow.soft
  },
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  reputationCard: {
    padding: mobileSpacing.lg,
    gap: 6
  },
  repRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  repTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  stars: { color: vetColors.warning, fontSize: 13, letterSpacing: 1 },
  ratingNum: {
    color: vetColors.textPrimary,
    fontWeight: "800",
    fontFamily: undefined
  },
  repMeta: {
    ...mobileTypography.meta,
    color: vetColors.textMuted
  },
  frow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: vetColors.border,
    gap: 8
  },
  frowLabel: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    width: "34%"
  },
  frowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: vetColors.textPrimary,
    textAlign: "right"
  },
  frowValueEmpty: { color: vetColors.textMuted },
  frowEdit: {
    fontSize: 12,
    fontWeight: "600",
    color: vetColors.primary,
    marginLeft: 4
  },
  switcherWrap: {
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: vetColors.border
  },
  readonlyHint: {
    ...mobileTypography.meta,
    color: vetColors.textMuted,
    paddingVertical: mobileSpacing.sm
  },
  modalRoot: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: vetColors.modalScrim,
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: vetColors.cardBg,
    borderTopLeftRadius: vetRadius.card,
    borderTopRightRadius: vetRadius.card,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    maxHeight: "88%",
    gap: mobileSpacing.sm
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm,
    paddingBottom: mobileSpacing.xs
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: vetColors.primaryLight
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: {
    paddingBottom: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    borderRadius: vetRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    color: vetColors.textPrimary,
    backgroundColor: vetColors.canvas
  },
  inputMulti: { minHeight: 100, textAlignVertical: "top" },
  saveRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.sm
  },
  cancelBtn: { padding: mobileSpacing.sm },
  cancelTx: { color: vetColors.textSecondary, fontWeight: "600" },
  saveBtn: {
    backgroundColor: vetColors.primary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: vetRadius.button,
    minWidth: 100,
    alignItems: "center"
  },
  saveTx: { color: vetColors.onPrimary, fontWeight: "700" }
});
