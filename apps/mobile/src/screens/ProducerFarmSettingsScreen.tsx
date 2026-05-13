import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  patchFarmFinanceSettings,
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
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const [editCurrencyCode, setEditCurrencyCode] = useState("");
  const [editCurrencySymbol, setEditCurrencySymbol] = useState("");
  const [editLowBalanceThreshold, setEditLowBalanceThreshold] = useState("");
  const settingsPrimed = useRef(false);

  useEffect(() => {
    settingsPrimed.current = false;
  }, [farmId]);

  const [modeDraft, setModeDraft] = useState<"individual" | "batch" | "hybrid">(
    "individual"
  );
  const [buildingsDraft, setBuildingsDraft] = useState("");
  const [pensDraft, setPensDraft] = useState("");
  const [capDraft, setCapDraft] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("producer.farmSettingsTitle")
    });
  }, [navigation, t]);

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

  const farmErr = farmQuery.error instanceof Error ? farmQuery.error.message : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.farmHint}>{farmName}</Text>

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
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.surface },
  scroll: { flex: 1 },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl * 2
  },
  farmHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
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
