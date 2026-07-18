import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSection } from "../../components/settings/SettingsSection";
import type { FarmSettingsDto, PatchFarmSettingsPayload } from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

function numStr(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "" : String(v);
}

export type ProducerSettingsSectionsProps = {
  s: FarmSettingsDto;
  farmId: string;
  farmName: string;
  financeEnabled: boolean;
  currencyLabel: string;
  localeCode: string;
  navigation: NativeStackNavigationProp<RootStackParamList, "ProducerFarmSettings">;
  save: (payload: PatchFarmSettingsPayload) => void;
  onOpenFarmName: () => void;
  onOpenBreeding: () => void;
  onOpenCurrency: () => void;
  onOpenLang: () => void;
  onOpenThreshold: () => void;
};

/**
 * Sections paramètres spécifiques producteur (ferme / régional / catégories…).
 * Contenu déplacé depuis SettingsScreen — ne pas réécrire ici.
 */
export function ProducerSettingsSections({
  s,
  farmId,
  farmName,
  financeEnabled,
  currencyLabel,
  localeCode,
  navigation,
  save,
  onOpenFarmName,
  onOpenBreeding,
  onOpenCurrency,
  onOpenLang,
  onOpenThreshold
}: ProducerSettingsSectionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSection title={t("settings.sectionFarm")}>
        <SettingsRow
          kind="navigation"
          label={t("settings.farmName")}
          value={s.farm.name}
          onPress={onOpenFarmName}
        />
        <SettingsRow
          kind="navigation"
          label={t("settings.location")}
          value={
            [s.farm.locationSector, s.farm.locationCity, s.farm.locationCountry]
              .filter(Boolean)
              .join(", ") ||
            s.farm.address ||
            farmName
          }
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
          onPress={onOpenBreeding}
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
          onPress={onOpenLang}
        />
        <SettingsRow
          kind="navigation"
          label={t("settings.currency")}
          value={currencyLabel}
          onPress={onOpenCurrency}
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
          onPress={onOpenThreshold}
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

      {financeEnabled ? (
        <>
          <SettingsSection title={t("settings.sectionProduction")}>
            <GmqInputRow
              label={t("settings.gmqRefStarter")}
              value={s.profitability.gmqRefStarter}
              onSave={(v) => save({ profitability: { gmqRefStarter: v } })}
            />
            <GmqInputRow
              label={t("settings.gmqRefGrowth")}
              value={s.profitability.gmqRefGrowth}
              onSave={(v) => save({ profitability: { gmqRefGrowth: v } })}
            />
            <GmqInputRow
              label={t("settings.gmqRefFattening")}
              value={s.profitability.gmqRefFattening}
              onSave={(v) => save({ profitability: { gmqRefFattening: v } })}
              isLast
            />
          </SettingsSection>

          <SettingsSection title={t("settings.sectionProfitability")}>
            <DecimalInputRow
              label={t("settings.marketPrice")}
              value={numStr(s.profitability.marketPricePerKg)}
              unit={`${s.finance.currencySymbol}/kg`}
              onSave={(v) => save({ profitability: { marketPricePerKg: v } })}
            />
            <DecimalInputRow
              label={t("settings.icStarter")}
              value={numStr(s.profitability.icTargetStarter)}
              onSave={(v) => save({ profitability: { icTargetStarter: v } })}
            />
            <DecimalInputRow
              label={t("settings.icGrowth")}
              value={numStr(s.profitability.icTargetGrowth)}
              onSave={(v) => save({ profitability: { icTargetGrowth: v } })}
            />
            <DecimalInputRow
              label={t("settings.icFattening")}
              value={numStr(s.profitability.icTargetFattening)}
              onSave={(v) => save({ profitability: { icTargetFattening: v } })}
              isLast
            />
          </SettingsSection>

          <SettingsSection title={t("settings.sectionFinance")}>
            <DecimalInputRow
              label={t("settings.lowBalance")}
              value={numStr(s.finance.lowBalanceThreshold)}
              unit={s.finance.currencySymbol}
              onSave={(v) => save({ finance: { lowBalanceThreshold: v } })}
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
              onValueChange={(v) => save({ app: { budgetAutoSuggest: v } })}
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
          onSave={(v) => save({ alerts: { mortalityRateThresholdPct: v } })}
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
    </>
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
