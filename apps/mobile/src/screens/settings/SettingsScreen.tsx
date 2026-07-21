import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AccountSettingsPanel } from "../../components/account/AccountSettingsPanel";
import { NotificationSettingsRow } from "../../components/account/NotificationSettingsRow";
import { BreedingModeModal, type BreedingMode } from "../../components/settings/BreedingModeModal";
import { CURRENCY_OPTIONS, CurrencyModal } from "../../components/settings/CurrencyModal";
import { LanguageModal } from "../../components/settings/LanguageModal";
import { LegalDocumentModal } from "../../components/settings/LegalDocumentModal";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { ThresholdModal } from "../../components/settings/ThresholdModal";
import { BaseModal } from "../../components/modals/BaseModal";
import { useSession } from "../../context/SessionContext";
import { useScreenTitle } from "../../hooks/useScreenTitle";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { useSettingsSavedToast } from "../../hooks/useSettingsSavedToast";
import { type AppLocaleCode } from "../../lib/appLocale";
import {
  fetchFarmSettings,
  patchFarmSettings,
  type PatchFarmSettingsPayload
} from "../../lib/api";
import { fetchCguCurrent } from "../../lib/api/auth";
import { getUserFacingError } from "../../lib/userFacingError";
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { ProducerSettingsSections } from "./ProducerSettingsSections";
import { producerColors } from "../../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "ProducerFarmSettings">;

export function SettingsScreen({ route, navigation }: Props) {
  const farmId = route.params?.farmId;
  const farmName = route.params?.farmName ?? "";
  const { t, i18n } = useTranslation();
  useScreenTitle(navigation, t("settings.title"));
  const scrollPad = useScrollBottomPad();
  const { accessToken, activeProfileId, authMe, signOut, clientFeatures } =
    useSession();
  const qc = useQueryClient();
  const { savedToastVisible, savedToastMessage, showSaved } =
    useSettingsSavedToast();

  const profileType =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type ??
    authMe?.activeProfile?.type;

  const isProducer = profileType === "producer";
  const isTechnician = profileType === "technician";

  const [langModal, setLangModal] = useState(false);
  const [currencyModal, setCurrencyModal] = useState(false);
  const [breedingModal, setBreedingModal] = useState(false);
  const [thresholdModal, setThresholdModal] = useState(false);
  const [farmNameModal, setFarmNameModal] = useState(false);
  const [farmNameDraft, setFarmNameDraft] = useState("");
  const [legalModal, setLegalModal] = useState<"cgu" | "privacy" | null>(null);

  const cguQ = useQuery({
    queryKey: ["cguCurrent"],
    queryFn: () => fetchCguCurrent(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 10 * 60 * 1000
  });

  const settingsQ = useQuery({
    queryKey: ["farmSettings", farmId, activeProfileId],
    queryFn: () => fetchFarmSettings(accessToken!, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId && isProducer),
    retry: 2
  });

  const s = settingsQ.data;

  const patchMut = useMutation({
    mutationFn: (payload: PatchFarmSettingsPayload) =>
      patchFarmSettings(accessToken!, farmId!, payload, activeProfileId),
    onSuccess: (data) => {
      qc.setQueryData(["farmSettings", farmId, activeProfileId], data);
      void qc.invalidateQueries({ queryKey: ["financeOverview", farmId] });
      void qc.invalidateQueries({ queryKey: ["profitabilitySettings", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmAlertSettings", farmId] });
      showSaved();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const save = useCallback(
    (payload: PatchFarmSettingsPayload) => {
      patchMut.mutate(payload);
    },
    [patchMut]
  );

  const currencyLabel = useMemo(() => {
    const code = s?.finance.currencyCode ?? "XOF";
    return CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code;
  }, [s?.finance.currencyCode]);

  const localeCode = (i18n.resolvedLanguage ?? i18n.language).split(
    "-"
  )[0] as AppLocaleCode;

  const versionLabel = `${Constants.expoConfig?.version ?? "1.0.0"} (${
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode ??
    "dev"
  })`;

  if (isProducer && (!farmId || !accessToken)) {
    return (
      <View style={styles.centered} testID="settings-no-farm">
        <Text style={styles.errorTx}>{t("settings.noFarm")}</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => navigation.navigate("FarmList")}
        >
          <Text style={styles.retryBtnTx}>{t("settings.chooseFarm")}</Text>
        </Pressable>
      </View>
    );
  }

  if (isProducer && settingsQ.isPending && !s) {
    return (
      <View style={styles.loading} testID="settings-loading">
        <ActivityIndicator color={mobileColors.accent} size="large" />
      </View>
    );
  }

  if (isProducer && !s) {
    const errMsg =
      settingsQ.error instanceof Error
        ? getUserFacingError(settingsQ.error, t)
        : t("settings.loadError");
    return (
      <View style={styles.centered} testID="settings-load-error">
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={mobileColors.textSecondary}
        />
        <Text style={styles.errorTitle}>{t("settings.loadError")}</Text>
        <Text style={styles.errorTx}>{errMsg}</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => void settingsQ.refetch()}
        >
          <Text style={styles.retryBtnTx}>{t("common.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="settings-screen">
      {savedToastVisible ? (
        <View style={styles.toast}>
          <Text style={styles.toastTx}>{savedToastMessage}</Text>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
        keyboardShouldPersistTaps="handled"
        testID="settings-scroll"
      >
        {/*
          Producteur : sections ferme d’abord (non-régression de l’ordre historique),
          puis socle commun. Autres rôles : socle commun puis section rôle.
        */}
        {isProducer && s && farmId ? (
          <View testID="settings-producer-sections">
            <ProducerSettingsSections
              s={s}
              farmId={farmId}
              farmName={farmName || s.farm.name}
              financeEnabled={clientFeatures.finance}
              currencyLabel={currencyLabel}
              localeCode={localeCode}
              navigation={navigation}
              save={save}
              onOpenFarmName={() => {
                setFarmNameDraft(s.farm.name);
                setFarmNameModal(true);
              }}
              onOpenBreeding={() => setBreedingModal(true)}
              onOpenCurrency={() => setCurrencyModal(true)}
              onOpenLang={() => setLangModal(true)}
              onOpenThreshold={() => setThresholdModal(true)}
            />
          </View>
        ) : null}

        {/* —— Socle commun (tous les rôles) —— */}
        <View testID="settings-common-base">
          <Text style={styles.sectionTitle}>{t("settings.sectionAccount")}</Text>
          <View style={styles.accountPanelWrap}>
            <AccountSettingsPanel accountOnly />
          </View>

          <View style={styles.notificationWrap} testID="settings-notifications">
            <NotificationSettingsRow />
          </View>

          {/* Langue du socle : hors producteur (déjà dans section Régional déplacée). */}
          {!isProducer ? (
            <SettingsSection title={t("settings.sectionPreferences")}>
              <SettingsRow
                kind="navigation"
                label={t("settings.language")}
                value={localeCode === "en" ? "English" : "Français"}
                onPress={() => setLangModal(true)}
                isLast
              />
            </SettingsSection>
          ) : null}

          {isTechnician ? (
            <View testID="settings-technician-sections">
              <SettingsSection title={t("tech.profile.sectionTech")}>
                <SettingsRow
                  kind="navigation"
                  label={t("tech.profile.edit")}
                  onPress={() => navigation.navigate("TechProfileEdit")}
                  isLast
                />
              </SettingsSection>
            </View>
          ) : null}

          {/* TODO: sections paramètres vétérinaire (PR dédiée) */}
          {profileType === "veterinarian" ? (
            <View testID="settings-vet-sections" />
          ) : null}

          {/* TODO: sections paramètres acheteur (PR dédiée) */}
          {profileType === "buyer" ? (
            <View testID="settings-buyer-sections" />
          ) : null}

          {/* TODO: sections paramètres marchand (PR dédiée) */}
          {profileType === "merchant" ? (
            <View testID="settings-merchant-sections" />
          ) : null}

          <SettingsSection title={t("settings.sectionSecurity")}>
            {authMe?.user?.email ? (
              <SettingsRow
                kind="navigation"
                label={t("settings.changePassword")}
                onPress={() =>
                  Alert.alert(
                    t("settings.changePassword"),
                    t("settings.changePasswordHint")
                  )
                }
              />
            ) : null}
            <SettingsRow
              kind="button"
              label={t("account.signOut")}
              tone="warning"
              onPress={() => {
                Alert.alert(t("account.signOut"), t("settings.signOutConfirm"), [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("account.signOut"),
                    style: "destructive",
                    onPress: () => void signOut()
                  }
                ]);
              }}
            />
            <SettingsRow
              kind="button"
              label={t("account.dangerZone.deleteAccount")}
              tone="danger"
              onPress={() => navigation.navigate("DeleteAccountProcess")}
              isLast
            />
          </SettingsSection>

          <SettingsSection title={t("settings.sectionAbout")}>
            <SettingsRow
              kind="value"
              label={t("settings.appVersion")}
              value={versionLabel}
            />
            <SettingsRow
              kind="navigation"
              label={t("cgu.title")}
              subtitle={t("settings.cguSubtitle")}
              onPress={() => setLegalModal("cgu")}
            />
            <SettingsRow
              kind="navigation"
              label={t("cgu.privacy.title")}
              subtitle={t("settings.privacySubtitle")}
              onPress={() => setLegalModal("privacy")}
              isLast
            />
          </SettingsSection>
        </View>
      </ScrollView>

      <LanguageModal
        visible={langModal}
        current={localeCode}
        onClose={() => setLangModal(false)}
        onSaved={(code) => {
          if (isProducer && farmId) {
            save({ app: { language: code } });
          }
        }}
      />

      {s ? (
        <>
          <CurrencyModal
            visible={currencyModal}
            currentCode={s.finance.currencyCode}
            onClose={() => setCurrencyModal(false)}
            onSelect={(code, symbol) =>
              save({ finance: { currencyCode: code, currencySymbol: symbol } })
            }
          />
          <BreedingModeModal
            visible={breedingModal}
            current={s.farm.livestockMode as BreedingMode}
            onClose={() => setBreedingModal(false)}
            onSelect={(mode) => save({ farm: { livestockMode: mode } })}
          />
          <ThresholdModal
            visible={thresholdModal}
            weightKg={s.alerts.starterMaxAvgWeightKg ?? 30}
            ageWeeks={s.alerts.starterMaxAvgAgeWeeks ?? 10}
            onClose={() => setThresholdModal(false)}
            onSave={(kg, weeks) =>
              save({
                alerts: {
                  starterMaxAvgWeightKg: kg,
                  starterMaxAvgAgeWeeks: weeks
                }
              })
            }
          />
          <BaseModal
            visible={farmNameModal}
            onClose={() => setFarmNameModal(false)}
            title={t("settings.farmName")}
            footerPrimary={
              <Pressable
                style={styles.saveBtn}
                onPress={() => {
                  const name = farmNameDraft.trim();
                  if (name) {
                    save({ farm: { name } });
                    setFarmNameModal(false);
                  }
                }}
              >
                <Text style={styles.saveBtnTx}>{t("settings.save")}</Text>
              </Pressable>
            }
          >
            <TextInput
              style={styles.nameInput}
              value={farmNameDraft}
              onChangeText={setFarmNameDraft}
              placeholderTextColor={mobileColors.textSecondary}
            />
          </BaseModal>
        </>
      ) : null}

      <LegalDocumentModal
        visible={legalModal === "cgu"}
        title={t("cgu.title")}
        content={cguQ.data?.content ?? t("settings.legalLoading")}
        onClose={() => setLegalModal(null)}
      />
      <LegalDocumentModal
        visible={legalModal === "privacy"}
        title={t("cgu.privacy.title")}
        content={cguQ.data?.privacyPolicyContent ?? t("settings.legalLoading")}
        onClose={() => setLegalModal(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  scroll: { flex: 1 },
  content: { paddingTop: mobileSpacing.md, paddingHorizontal: mobileSpacing.md },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.canvas
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.canvas,
    padding: mobileSpacing.xl,
    gap: mobileSpacing.md
  },
  errorTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center"
  },
  errorTx: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  retryBtn: {
    marginTop: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accent
  },
  retryBtnTx: {
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  toast: {
    position: "absolute",
    top: 8,
    left: mobileSpacing.md,
    right: mobileSpacing.md,
    zIndex: 10,
    backgroundColor: producerColors.settingsGreen,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    alignItems: "center"
  },
  toastTx: { color: mobileColors.onAccent, fontWeight: "600" },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  saveBtnTx: { color: mobileColors.onAccent, fontWeight: "600" },
  nameInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    ...mobileTypography.body
  },
  sectionTitle: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: mobileSpacing.xs,
    marginLeft: mobileSpacing.md
  },
  accountPanelWrap: {
    marginBottom: mobileSpacing.lg
  },
  notificationWrap: {
    marginBottom: mobileSpacing.lg
  }
});
