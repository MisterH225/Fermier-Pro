import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import {
  fetchFarm,
  fetchFinanceOverview,
  fetchProfitabilitySettings,
  patchFarmFinanceSettings,
  patchProfitabilitySettings,
  updateFarmCheptelConfig,
  type FinanceOverviewDto
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "ProducerFarmSettings">;

export function ProducerFarmSettingsScreen({ route, navigation }: Props) {
  const { farmId } = route.params;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("producer.farmSettingsTitle"));
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const [editCurrencyCode, setEditCurrencyCode] = useState("");
  const [editCurrencySymbol, setEditCurrencySymbol] = useState("");
  const [editLowBalanceThreshold, setEditLowBalanceThreshold] = useState("");
  const [marketPricePerKg, setMarketPricePerKg] = useState("");
  const [icStarter, setIcStarter] = useState("1.8");
  const [icGrowth, setIcGrowth] = useState("2.8");
  const [icFattening, setIcFattening] = useState("3.2");
  const [gmqStarter, setGmqStarter] = useState("300");
  const [gmqGrowth, setGmqGrowth] = useState("450");
  const [gmqFattening, setGmqFattening] = useState("650");
  const settingsPrimed = useRef(false);
  const profitabilityPrimed = useRef(false);

  useEffect(() => {
    settingsPrimed.current = false;
    profitabilityPrimed.current = false;
  }, [farmId]);

  const [modeDraft, setModeDraft] = useState<"individual" | "batch" | "hybrid">(
    "individual"
  );
  const [buildingsDraft, setBuildingsDraft] = useState("");
  const [pensDraft, setPensDraft] = useState("");
  const [capDraft, setCapDraft] = useState("");

  const farmQuery = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const overviewQ = useQuery({
    queryKey: ["financeOverview", farmId, activeProfileId],
    queryFn: () => fetchFinanceOverview(accessToken!, farmId, activeProfileId),
    enabled: Boolean(clientFeatures.finance && accessToken && farmId)
  });

  const profitabilitySettingsQ = useQuery({
    queryKey: ["profitabilitySettings", farmId, activeProfileId],
    queryFn: () =>
      fetchProfitabilitySettings(accessToken!, farmId, activeProfileId),
    enabled: Boolean(clientFeatures.finance && accessToken && farmId)
  });

  const overview = overviewQ.data as FinanceOverviewDto | undefined;

  useEffect(() => {
    const f = farmQuery.data;
    if (!f) {
      return;
    }
    const m = f.livestockMode;
    if (m === "individual" || m === "batch" || m === "hybrid") {
      setModeDraft(m);
    }
    setBuildingsDraft(
      f.housingBuildingsCount != null ? String(f.housingBuildingsCount) : ""
    );
    setPensDraft(
      f.housingPensPerBuilding != null ? String(f.housingPensPerBuilding) : ""
    );
    setCapDraft(
      f.housingMaxPigsPerPen != null ? String(f.housingMaxPigsPerPen) : ""
    );
  }, [farmQuery.data]);

  useEffect(() => {
    if (!overview || settingsPrimed.current) {
      return;
    }
    settingsPrimed.current = true;
    setEditCurrencyCode(overview.settings.currencyCode);
    setEditCurrencySymbol(overview.settings.currencySymbol);
    setEditLowBalanceThreshold(
      overview.settings.lowBalanceThreshold
        ? String(overview.settings.lowBalanceThreshold)
        : ""
    );
  }, [overview]);

  useEffect(() => {
    const p = profitabilitySettingsQ.data;
    if (!p || profitabilityPrimed.current) {
      return;
    }
    profitabilityPrimed.current = true;
    setMarketPricePerKg(
      p.marketPricePerKg != null ? String(p.marketPricePerKg) : ""
    );
    setIcStarter(String(p.icTargetStarter));
    setIcGrowth(String(p.icTargetGrowth));
    setIcFattening(String(p.icTargetFattening));
    setGmqStarter(String(p.gmqRefStarter));
    setGmqGrowth(String(p.gmqRefGrowth));
    setGmqFattening(String(p.gmqRefFattening));
  }, [profitabilitySettingsQ.data]);

  const saveCheptelConfigMut = useMutation({
    mutationFn: () => {
      const parseOpt = (s: string) => {
        const x = s.trim();
        if (!x) {
          return null;
        }
        const n = Number.parseInt(x, 10);
        return Number.isFinite(n) ? n : null;
      };
      return updateFarmCheptelConfig(
        accessToken!,
        farmId,
        {
          livestockMode: modeDraft,
          housingBuildingsCount: parseOpt(buildingsDraft),
          housingPensPerBuilding: parseOpt(pensDraft),
          housingMaxPigsPerPen: parseOpt(capDraft)
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farm", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
      Alert.alert(t("producer.farmCheptelConfigSaved"));
    },
    onError: (e: Error) =>
      Alert.alert(t("financeScreen.errorTitle"), e.message)
  });

  const settingsPatch = useMutation({
    mutationFn: () =>
      patchFarmFinanceSettings(
        accessToken!,
        farmId,
        {
          currencyCode: editCurrencyCode.trim() || undefined,
          currencySymbol: editCurrencySymbol.trim() || undefined,
          lowBalanceThreshold:
            editLowBalanceThreshold.trim() === ""
              ? undefined
              : Number(editLowBalanceThreshold.replace(",", "."))
        },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financeOverview", farmId] });
      Alert.alert(t("financeScreen.savedTitle"), t("financeScreen.savedSettings"));
    },
    onError: (e: Error) => Alert.alert(t("financeScreen.errorTitle"), e.message)
  });

  const profitabilityPatch = useMutation({
    mutationFn: () => {
      const mp = marketPricePerKg.trim();
      if (!mp) {
        throw new Error("market_price_required");
      }
      return patchProfitabilitySettings(
        accessToken!,
        farmId,
        {
          marketPricePerKg: Number.parseFloat(mp.replace(",", ".")),
          icTargetStarter: Number.parseFloat(icStarter.replace(",", ".")),
          icTargetGrowth: Number.parseFloat(icGrowth.replace(",", ".")),
          icTargetFattening: Number.parseFloat(icFattening.replace(",", ".")),
          gmqRefStarter: Number.parseInt(gmqStarter, 10),
          gmqRefGrowth: Number.parseInt(gmqGrowth, 10),
          gmqRefFattening: Number.parseInt(gmqFattening, 10)
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profitabilitySettings", farmId] });
      void qc.invalidateQueries({ queryKey: ["profitability", farmId] });
      Alert.alert(t("financeScreen.savedTitle"), t("profitability.savedSettings"));
    },
    onError: (e: Error) =>
      Alert.alert(
        t("financeScreen.errorTitle"),
        e.message === "market_price_required"
          ? t("profitability.marketPricePerKg")
          : e.message
      )
  });

  const farmErr = farmQuery.error instanceof Error ? farmQuery.error.message : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>{t("cheptel.sectionConfig")}</Text>
        {farmQuery.isPending && !farmQuery.data ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : null}
        {farmErr ? <Text style={styles.error}>{farmErr}</Text> : null}

        <Text style={styles.fieldLab}>{t("cheptel.modeLabel")}</Text>
        <View style={styles.modeRow}>
          {(
            [
              ["individual", t("cheptel.modeIndividual")],
              ["batch", t("cheptel.modeBatch")],
              ["hybrid", t("cheptel.modeMixed")]
            ] as const
          ).map(([val, lab]) => (
            <TouchableOpacity
              key={val}
              style={[styles.modeChip, modeDraft === val && styles.modeChipOn]}
              onPress={() => setModeDraft(val)}
            >
              <Text
                style={[
                  styles.modeChipText,
                  modeDraft === val && styles.modeChipTextOn
                ]}
              >
                {lab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.fieldLab}>{t("cheptel.buildings")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={buildingsDraft}
          onChangeText={setBuildingsDraft}
          placeholder="—"
          placeholderTextColor={mobileColors.textSecondary}
        />
        <Text style={styles.fieldLab}>{t("cheptel.pensPerBuilding")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={pensDraft}
          onChangeText={setPensDraft}
          placeholder="—"
          placeholderTextColor={mobileColors.textSecondary}
        />
        <Text style={styles.fieldLab}>{t("cheptel.maxPerPen")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={capDraft}
          onChangeText={setCapDraft}
          placeholder="—"
          placeholderTextColor={mobileColors.textSecondary}
        />
        <TouchableOpacity
          style={[
            styles.saveCheptelBtn,
            saveCheptelConfigMut.isPending && styles.saveBtnDisabled
          ]}
          disabled={saveCheptelConfigMut.isPending || !farmQuery.data}
          onPress={() => saveCheptelConfigMut.mutate()}
        >
          <Text style={styles.saveCheptelBtnTx}>
            {saveCheptelConfigMut.isPending
              ? t("cheptel.saving")
              : t("cheptel.saveConfig")}
          </Text>
        </TouchableOpacity>

        {clientFeatures.finance ? (
          <>
            <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
              {t("financeScreen.settings")}
            </Text>
            {overviewQ.isPending && !overview ? (
              <ActivityIndicator color={mobileColors.accent} />
            ) : null}
            {overviewQ.error instanceof Error ? (
              <Text style={styles.error}>{overviewQ.error.message}</Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={editCurrencyCode}
              onChangeText={setEditCurrencyCode}
              placeholder="ISO (XOF)"
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              value={editCurrencySymbol}
              onChangeText={setEditCurrencySymbol}
              placeholder={t("financeScreen.currencySymbolPh")}
            />
            <TextInput
              style={styles.input}
              value={editLowBalanceThreshold}
              onChangeText={setEditLowBalanceThreshold}
              placeholder={t("financeScreen.lowBalancePh")}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => settingsPatch.mutate()}
              disabled={settingsPatch.isPending}
            >
              <Text style={styles.primaryBtnTx}>
                {t("financeScreen.saveSettings")}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
              {t("profitability.settingsTitle")}
            </Text>
            <Text style={styles.fieldLab}>{t("profitability.marketPricePerKg")}</Text>
            <Text style={styles.fieldHint}>{t("profitability.marketPriceHelp")}</Text>
            <TextInput
              style={styles.input}
              value={marketPricePerKg}
              onChangeText={setMarketPricePerKg}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLab}>{t("profitability.icTargetStarter")}</Text>
            <TextInput
              style={styles.input}
              value={icStarter}
              onChangeText={setIcStarter}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLab}>{t("profitability.icTargetGrowth")}</Text>
            <TextInput
              style={styles.input}
              value={icGrowth}
              onChangeText={setIcGrowth}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLab}>{t("profitability.icTargetFattening")}</Text>
            <TextInput
              style={styles.input}
              value={icFattening}
              onChangeText={setIcFattening}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLab}>{t("profitability.gmqRefStarter")}</Text>
            <TextInput
              style={styles.input}
              value={gmqStarter}
              onChangeText={setGmqStarter}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLab}>{t("profitability.gmqRefGrowth")}</Text>
            <TextInput
              style={styles.input}
              value={gmqGrowth}
              onChangeText={setGmqGrowth}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLab}>{t("profitability.gmqRefFattening")}</Text>
            <TextInput
              style={styles.input}
              value={gmqFattening}
              onChangeText={setGmqFattening}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => profitabilityPatch.mutate()}
              disabled={profitabilityPatch.isPending}
            >
              <Text style={styles.primaryBtnTx}>
                {t("profitability.saveSettings")}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  scroll: { flex: 1 },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl * 2
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.md
  },
  sectionSpacer: {
    marginTop: mobileSpacing.xl
  },
  error: { color: mobileColors.error, marginBottom: mobileSpacing.sm },
  fieldLab: {
    ...mobileTypography.meta,
    marginTop: mobileSpacing.md,
    marginBottom: 4,
    color: mobileColors.textSecondary
  },
  fieldHint: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  modeChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  modeChipText: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textPrimary
  },
  modeChipTextOn: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    color: mobileColors.textPrimary
  },
  saveCheptelBtn: {
    marginTop: mobileSpacing.lg,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  saveCheptelBtnTx: { color: "#fff", fontWeight: "800" },
  saveBtnDisabled: {
    opacity: 0.6
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  primaryBtnTx: { color: "#fff", fontWeight: "800" }
});
