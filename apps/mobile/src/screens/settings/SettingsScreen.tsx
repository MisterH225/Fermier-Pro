import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BreedingModeModal, type BreedingMode } from "../../components/settings/BreedingModeModal";
import { CURRENCY_OPTIONS, CurrencyModal } from "../../components/settings/CurrencyModal";
import { LanguageModal } from "../../components/settings/LanguageModal";
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
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "ProducerFarmSettings">;

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

function numStr(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "" : String(v);
}

export function SettingsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t, i18n } = useTranslation();
  useScreenTitle(navigation, t("settings.title"));
  const scrollPad = useScrollBottomPad();
  const { accessToken, activeProfileId, authMe, signOut, clientFeatures } =
    useSession();
  const qc = useQueryClient();
  const { savedToastVisible, savedToastMessage, showSaved } =
    useSettingsSavedToast();

  const [langModal, setLangModal] = useState(false);
  const [currencyModal, setCurrencyModal] = useState(false);
  const [breedingModal, setBreedingModal] = useState(false);
  const [thresholdModal, setThresholdModal] = useState(false);
  const [farmNameModal, setFarmNameModal] = useState(false);
  const [farmNameDraft, setFarmNameDraft] = useState("");

  const settingsQ = useQuery({
    queryKey: ["farmSettings", farmId, activeProfileId],
    queryFn: () => fetchFarmSettings(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId),
    retry: 2
  });

  const s = settingsQ.data;

  const patchMut = useMutation({
    mutationFn: (payload: PatchFarmSettingsPayload) =>
      patchFarmSettings(accessToken!, farmId, payload, activeProfileId),
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
    return (
      CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code
    );
  }, [s?.finance.currencyCode]);

  const localeCode = (i18n.resolvedLanguage ?? i18n.language).split(
    "-"
  )[0] as AppLocaleCode;

  const versionLabel = `${Constants.expoConfig?.version ?? "1.0.0"} (${
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode ??
    "dev"
  })`;

  if (!farmId || !accessToken) {
    return (
      <View style={styles.centered}>
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

  if (settingsQ.isPending && !s) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={mobileColors.accent} size="large" />
      </View>
    );
  }

  if (!s) {
    const errMsg =
      settingsQ.error instanceof Error
        ? getUserFacingError(settingsQ.error, t)
        : t("settings.loadError");
    return (
      <View style={styles.centered}>
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
    <View style={styles.root}>
      {savedToastVisible ? (
        <View style={styles.toast}>
          <Text style={styles.toastTx}>{savedToastMessage}</Text>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <SettingsSection title={t("settings.sectionFarm")}>
          <SettingsRow
            kind="navigation"
            label={t("settings.farmName")}
            value={s.farm.name}
            onPress={() => {
              setFarmNameDraft(s.farm.name);
              setFarmNameModal(true);
            }}
          />
          <SettingsRow
            kind="navigation"
            label={t("settings.location")}
            value={s.farm.address ?? farmName}
            onPress={() =>
              navigation.navigate("FarmDetail", { farmId, farmName })
            }
          />
          <SettingsRow
            kind="value"
            label={t("settings.speculation")}
            value={t("settings.speculationPig")}
          />
          <SettingsRow
            kind="navigation"
            label={t("settings.breedingMode")}
            value={
              s.farm.livestockMode === "hybrid"
                ? t("cheptel.modeMixed")
                : s.farm.livestockMode === "batch"
                  ? t("cheptel.modeBatch")
                  : t("cheptel.modeIndividual")
            }
            onPress={() => setBreedingModal(true)}
          />
          <SettingsRow
            kind="navigation"
            label={t("settings.buildings")}
            subtitle={t("settings.buildingsSub")}
            onPress={() =>
              navigation.navigate("FarmBarns", { farmId, farmName })
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t("settings.sectionRegional")}>
          <SettingsRow
            kind="navigation"
            label={t("settings.language")}
            value={localeCode === "en" ? "English" : "Français"}
            onPress={() => setLangModal(true)}
          />
          <SettingsRow
            kind="navigation"
            label={t("settings.currency")}
            value={currencyLabel}
            onPress={() => setCurrencyModal(true)}
          />
          <SettingsRow
            kind="navigation"
            label={t("settings.dateFormat")}
            value={s.app.dateFormat}
            onPress={() => {
              const idx = DATE_FORMATS.indexOf(
                s.app.dateFormat as (typeof DATE_FORMATS)[number]
              );
              const next = DATE_FORMATS[(idx + 1) % DATE_FORMATS.length];
              save({ app: { dateFormat: next } });
            }}
          />
          <SettingsRow
            kind="value"
            label={t("settings.timezone")}
            value={s.app.timezone}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t("settings.sectionCheptel")}>
          <SettingsRow
            kind="navigation"
            label={t("settings.starterThreshold")}
            value={t("settings.starterThresholdPreview", {
              kg: s.alerts.starterMaxAvgWeightKg ?? 30,
              weeks: s.alerts.starterMaxAvgAgeWeeks ?? 10
            })}
            onPress={() => setThresholdModal(true)}
          />
          <SettingsRow
            kind="inline_stepper"
            label={t("settings.weaningDays")}
            value={s.gestation.weaningDurationDays}
            unit={t("settings.days")}
            min={21}
            max={35}
            onChange={(v) => save({ gestation: { weaningDurationDays: v } })}
          />
          <SettingsRow
            kind="value"
            label={t("settings.gestationDuration")}
            value={t("settings.gestationDurationValue")}
            isLast
          />
        </SettingsSection>

        {clientFeatures.finance ? (
          <>
            <SettingsSection title={t("settings.sectionProduction")}>
              <GmqInputRow
                label={t("settings.gmqRefStarter")}
                value={s.profitability.gmqRefStarter}
                onSave={(v) =>
                  save({ profitability: { gmqRefStarter: v } })
                }
              />
              <GmqInputRow
                label={t("settings.gmqRefGrowth")}
                value={s.profitability.gmqRefGrowth}
                onSave={(v) => save({ profitability: { gmqRefGrowth: v } })}
              />
              <GmqInputRow
                label={t("settings.gmqRefFattening")}
                value={s.profitability.gmqRefFattening}
                onSave={(v) =>
                  save({ profitability: { gmqRefFattening: v } })
                }
                isLast
              />
            </SettingsSection>

            <SettingsSection title={t("settings.sectionProfitability")}>
              <DecimalInputRow
                label={t("settings.marketPrice")}
                value={numStr(s.profitability.marketPricePerKg)}
                unit={`${s.finance.currencySymbol}/kg`}
                onSave={(v) =>
                  save({ profitability: { marketPricePerKg: v } })
                }
              />
              <DecimalInputRow
                label={t("settings.icStarter")}
                value={numStr(s.profitability.icTargetStarter)}
                onSave={(v) =>
                  save({ profitability: { icTargetStarter: v } })
                }
              />
              <DecimalInputRow
                label={t("settings.icGrowth")}
                value={numStr(s.profitability.icTargetGrowth)}
                onSave={(v) =>
                  save({ profitability: { icTargetGrowth: v } })
                }
              />
              <DecimalInputRow
                label={t("settings.icFattening")}
                value={numStr(s.profitability.icTargetFattening)}
                onSave={(v) =>
                  save({ profitability: { icTargetFattening: v } })
                }
                isLast
              />
            </SettingsSection>

            <SettingsSection title={t("settings.sectionFinance")}>
              <DecimalInputRow
                label={t("settings.lowBalance")}
                value={numStr(s.finance.lowBalanceThreshold)}
                unit={s.finance.currencySymbol}
                onSave={(v) =>
                  save({ finance: { lowBalanceThreshold: v } })
                }
              />
              <SettingsRow
                kind="navigation"
                label={t("settings.expenseCategories")}
                subtitle={t("settings.expenseCategoriesSub")}
                onPress={() =>
                  navigation.navigate("SettingsExpenseCategories", {
                    farmId,
                    farmName
                  })
                }
              />
              <SettingsRow
                kind="toggle"
                label={t("settings.budgetAuto")}
                value={s.app.budgetAutoSuggest}
                onValueChange={(v) =>
                  save({ app: { budgetAutoSuggest: v } })
                }
                isLast
              />
            </SettingsSection>
          </>
        ) : null}

        <SettingsSection title={t("settings.sectionAlerts")}>
          <IntInputRow
            label={t("settings.stockCritical")}
            value={s.alerts.stockCriticalDays}
            unit={t("settings.daysRemaining")}
            onSave={(v) => save({ alerts: { stockCriticalDays: v } })}
          />
          <IntInputRow
            label={t("settings.stockWarning")}
            value={s.alerts.stockWarningDays}
            unit={t("settings.daysRemaining")}
            onSave={(v) => save({ alerts: { stockWarningDays: v } })}
          />
          <DecimalInputRow
            label={t("settings.mortalityThreshold")}
            value={numStr(s.alerts.mortalityRateThresholdPct ?? 5)}
            unit="%"
            onSave={(v) =>
              save({ alerts: { mortalityRateThresholdPct: v } })
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection
          title={t("settings.sectionNotifications")}
          subtitle={t("settings.notificationsSub")}
        >
          <SettingsRow
            kind="toggle"
            label={t("smartAlerts.settings.pushStock")}
            value={s.alerts.pushStock}
            onValueChange={(v) => save({ alerts: { pushStock: v } })}
          />
          <SettingsRow
            kind="toggle"
            label={t("smartAlerts.settings.pushHealth")}
            value={s.alerts.pushHealth}
            onValueChange={(v) => save({ alerts: { pushHealth: v } })}
          />
          <SettingsRow
            kind="toggle"
            label={t("smartAlerts.settings.pushGestation")}
            value={s.alerts.pushGestation}
            onValueChange={(v) => save({ alerts: { pushGestation: v } })}
          />
          <SettingsRow
            kind="toggle"
            label={t("smartAlerts.settings.pushFinance")}
            value={s.alerts.pushFinance}
            onValueChange={(v) => save({ alerts: { pushFinance: v } })}
          />
          <SettingsRow
            kind="toggle"
            label={t("smartAlerts.settings.pushCheptel")}
            value={s.alerts.pushCheptel}
            onValueChange={(v) => save({ alerts: { pushCheptel: v } })}
          />
          <SettingsRow
            kind="toggle"
            label={t("smartAlerts.settings.pushMarket")}
            value={s.alerts.pushMarket}
            onValueChange={(v) => save({ alerts: { pushMarket: v } })}
            isLast
          />
        </SettingsSection>

        <SettingsSection title={t("settings.sectionVaccine")}>
          <SettingsRow
            kind="navigation"
            label={t("settings.vaccineCalendar")}
            subtitle={t("settings.vaccineCalendarSub")}
            onPress={() =>
              navigation.navigate("FarmHealth", {
                farmId,
                farmName,
                initialTab: "vaccination"
              })
            }
            isLast
          />
        </SettingsSection>

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
            onPress={() =>
              Alert.alert(t("cgu.title"), t("settings.cguHint"))
            }
          />
          <SettingsRow
            kind="navigation"
            label={t("cgu.privacy.title")}
            onPress={() =>
              Alert.alert(t("cgu.privacy.title"), t("settings.privacyHint"))
            }
            isLast
          />
        </SettingsSection>
      </ScrollView>

      <LanguageModal
        visible={langModal}
        current={localeCode}
        onClose={() => setLangModal(false)}
        onSaved={(code) => {
          save({ app: { language: code } });
        }}
      />
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
    </View>
  );
}

function GmqInputRow({
  label,
  value,
  onSave,
  isLast
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
  isLast?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <SettingsRow
      kind="inline_input"
      label={label}
      value={text}
      unit="g/j"
      keyboardType="number-pad"
      onChangeText={setText}
      onBlur={() => {
        const n = Number.parseInt(text, 10);
        if (Number.isFinite(n)) {
          onSave(n);
        }
      }}
      isLast={isLast}
    />
  );
}

function DecimalInputRow({
  label,
  value,
  unit,
  onSave,
  isLast
}: {
  label: string;
  value: string;
  unit?: string;
  onSave: (v: number) => void;
  isLast?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <SettingsRow
      kind="inline_input"
      label={label}
      value={text}
      unit={unit}
      onChangeText={setText}
      onBlur={() => {
        const n = Number.parseFloat(text.replace(",", "."));
        if (Number.isFinite(n)) {
          onSave(n);
        }
      }}
      isLast={isLast}
    />
  );
}

function IntInputRow({
  label,
  value,
  unit,
  onSave,
  isLast
}: {
  label: string;
  value: number;
  unit?: string;
  onSave: (v: number) => void;
  isLast?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <SettingsRow
      kind="inline_input"
      label={label}
      value={text}
      unit={unit}
      keyboardType="number-pad"
      onChangeText={setText}
      onBlur={() => {
        const n = Number.parseInt(text, 10);
        if (Number.isFinite(n)) {
          onSave(n);
        }
      }}
      isLast={isLast}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  scroll: { flex: 1 },
  content: { paddingTop: mobileSpacing.md, paddingHorizontal: mobileSpacing.md },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f7"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f7",
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
    borderRadius: 10,
    backgroundColor: mobileColors.accent
  },
  retryBtnTx: {
    color: "#fff",
    fontWeight: "700"
  },
  toast: {
    position: "absolute",
    top: 8,
    left: mobileSpacing.md,
    right: mobileSpacing.md,
    zIndex: 10,
    backgroundColor: "#1a7f37",
    borderRadius: 10,
    padding: mobileSpacing.sm,
    alignItems: "center"
  },
  toastTx: { color: "#fff", fontWeight: "600" },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: 10,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  saveBtnTx: { color: "#fff", fontWeight: "600" },
  nameInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 8,
    padding: mobileSpacing.md,
    ...mobileTypography.body
  }
});
