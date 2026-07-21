import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import { ScreenSection } from "../components/layout";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useSession } from "../context/SessionContext";
import {
  HISTORICAL_EXPENSE_CATEGORIES,
  HISTORICAL_INCOME_CATEGORIES,
  confirmHistoricalImport,
  createHistoricalQuickTotal,
  deleteHistoricalRecord,
  fetchHistoricalRecords,
  fetchHistoricalSummary,
  previewHistoricalImport,
  type HistoricalCategory,
  type HistoricalImportPreviewDto,
  type HistoricalMovementType
} from "../lib/api/historical-records";
import { invalidateFarmFinanceQueries } from "../lib/invalidateFarmFinanceQueries";
import { formatFarmMoney as formatMoney } from "../lib/formatMoney";
import { getQueryErrorMessage } from "../lib/userFacingError";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "HistoricalRecords">;

type Mode = "choice" | "quick_total" | "import";

const CURRENCY = "XOF";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(n: number): string {
  return formatMoney(n, CURRENCY, "FCFA");
}

export function HistoricalRecordsScreen({ route, navigation }: Props) {
  const { farmId } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  useScreenTitle(navigation, t("historicalRecords.title"));

  const [mode, setMode] = useState<Mode>("choice");
  const [movementType, setMovementType] =
    useState<HistoricalMovementType>("expense");
  const [category, setCategory] = useState<HistoricalCategory>("aliments");
  const [amount, setAmount] = useState("");
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [importPreview, setImportPreview] =
    useState<HistoricalImportPreviewDto | null>(null);
  const [importFilename, setImportFilename] = useState<string | null>(null);

  const summaryQ = useQuery({
    queryKey: ["historicalSummary", farmId, activeProfileId],
    queryFn: () =>
      fetchHistoricalSummary(farmId, accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const recordsQ = useQuery({
    queryKey: ["historicalRecords", farmId, activeProfileId],
    queryFn: () =>
      fetchHistoricalRecords(farmId, accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidateAll = useCallback(() => {
    void summaryQ.refetch();
    void recordsQ.refetch();
    invalidateFarmFinanceQueries(qc, farmId);
  }, [farmId, qc, recordsQ, summaryQ]);

  const categories = useMemo(
    () =>
      movementType === "expense"
        ? HISTORICAL_EXPENSE_CATEGORIES
        : HISTORICAL_INCOME_CATEGORIES,
    [movementType]
  );

  const quickTotalMut = useMutation({
    mutationFn: () =>
      createHistoricalQuickTotal(
        farmId,
        {
          movementType,
          category,
          amount: Number(amount.replace(",", ".")),
          periodEnd,
          notes: notes.trim() || undefined
        },
        accessToken!,
        activeProfileId
      ),
    onSuccess: () => {
      invalidateAll();
      setMode("choice");
      setAmount("");
      setNotes("");
      Alert.alert(t("historicalRecords.savedTitle"), t("historicalRecords.savedBody"));
    },
    onError: (e) =>
      Alert.alert(
        t("financeScreen.errorTitle"),
        getQueryErrorMessage(e, t) ?? t("financeScreen.errorTitle")
      )
  });

  const importPreviewMut = useMutation({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*"
        ],
        copyToCacheDirectory: true
      });
      if (picked.canceled || !picked.assets[0]) {
        return null;
      }
      const asset = picked.assets[0];
      const preview = await previewHistoricalImport(
        farmId,
        {
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType
        },
        accessToken!,
        activeProfileId
      );
      return { preview, filename: asset.name };
    },
    onSuccess: (result) => {
      if (!result) return;
      setImportPreview(result.preview);
      setImportFilename(result.filename);
    },
    onError: (e) =>
      Alert.alert(
        t("financeScreen.errorTitle"),
        getQueryErrorMessage(e, t) ?? t("financeScreen.errorTitle")
      )
  });

  const importConfirmMut = useMutation({
    mutationFn: () =>
      confirmHistoricalImport(
        farmId,
        {
          filename: importFilename ?? "import.csv",
          rows: importPreview!.valid_rows
        },
        accessToken!,
        activeProfileId
      ),
    onSuccess: (res) => {
      invalidateAll();
      setImportPreview(null);
      setImportFilename(null);
      setMode("choice");
      Alert.alert(
        t("historicalRecords.importDoneTitle"),
        t("historicalRecords.importDoneBody", { count: res.inserted })
      );
    },
    onError: (e) =>
      Alert.alert(
        t("financeScreen.errorTitle"),
        getQueryErrorMessage(e, t) ?? t("financeScreen.errorTitle")
      )
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      deleteHistoricalRecord(farmId, id, accessToken!, activeProfileId),
    onSuccess: invalidateAll
  });

  const summary = summaryQ.data;
  const records = recordsQ.data ?? [];
  const loading = summaryQ.isLoading || recordsQ.isLoading;
  const refreshing = summaryQ.isFetching || recordsQ.isFetching;

  const categoryLabel = (key: string) =>
    t(`historicalRecords.categories.${key}`, key);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={invalidateAll} />
      }
    >
      <ScreenSection title={t("historicalRecords.summaryTitle")}>
        {loading && !summary ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : summary ? (
          <View style={styles.summaryGrid}>
            <SummaryCard
              label={t("historicalRecords.totalIncome")}
              value={money(summary.total_income)}
              tone="positive"
            />
            <SummaryCard
              label={t("historicalRecords.totalExpense")}
              value={money(summary.total_expense)}
              tone="negative"
            />
            <SummaryCard
              label={t("historicalRecords.netResult")}
              value={money(summary.net_result)}
              tone={summary.net_result >= 0 ? "positive" : "negative"}
            />
          </View>
        ) : null}
        <Text style={styles.hint}>{t("historicalRecords.walletHint")}</Text>
      </ScreenSection>

      {mode === "choice" ? (
        <>
          <ScreenSection title={t("historicalRecords.addData")}>
            <Pressable style={styles.choiceBtn} onPress={() => setMode("quick_total")}>
              <Text style={styles.choiceTitle}>
                {t("historicalRecords.quickTotalTitle")}
              </Text>
              <Text style={styles.choiceBody}>
                {t("historicalRecords.quickTotalBody")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.choiceBtn}
              onPress={() => {
                setMode("import");
                setImportPreview(null);
              }}
            >
              <Text style={styles.choiceTitle}>
                {t("historicalRecords.importTitle")}
              </Text>
              <Text style={styles.choiceBody}>
                {t("historicalRecords.importBody")}
              </Text>
            </Pressable>
          </ScreenSection>

          <ScreenSection title={t("historicalRecords.recordsTitle")}>
            {records.length === 0 ? (
              <Text style={styles.empty}>{t("historicalRecords.noRecords")}</Text>
            ) : (
              records.map((row) => (
                <View key={row.id} style={styles.recordRow}>
                  <View style={styles.recordMain}>
                    <Text style={styles.recordCat}>
                      {categoryLabel(row.category)}
                    </Text>
                    <Text style={styles.recordMeta}>
                      {row.movement_type === "income"
                        ? t("financeScreen.income")
                        : t("financeScreen.expense")}{" "}
                      · {row.period_end}
                      {row.entry_mode === "import"
                        ? ` · ${t("historicalRecords.importMode")}`
                        : ""}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.recordAmount,
                      row.movement_type === "income"
                        ? styles.amountPositive
                        : styles.amountNegative
                    ]}
                  >
                    {money(Number(row.amount))}
                  </Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        t("historicalRecords.deleteTitle"),
                        t("historicalRecords.deleteBody"),
                        [
                          { text: t("financeScreen.cancel"), style: "cancel" },
                          {
                            text: t("financeScreen.deleteShort"),
                            style: "destructive",
                            onPress: () => deleteMut.mutate(row.id)
                          }
                        ]
                      )
                    }
                  >
                    <Text style={styles.deleteLink}>
                      {t("financeScreen.deleteShort")}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScreenSection>
        </>
      ) : null}

      {mode === "quick_total" ? (
        <ScreenSection title={t("historicalRecords.quickTotalTitle")}>
          <View style={styles.segmentRow}>
            {(["expense", "income"] as const).map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.segment,
                  movementType === type && styles.segmentActive
                ]}
                onPress={() => {
                  setMovementType(type);
                  setCategory(type === "expense" ? "aliments" : "vente_animaux");
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    movementType === type && styles.segmentTextActive
                  ]}
                >
                  {type === "expense"
                    ? t("financeScreen.expense")
                    : t("financeScreen.income")}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>{t("financeScreen.fieldCategory")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === cat && styles.chipTextActive
                    ]}
                  >
                    {categoryLabel(cat)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>{t("financeScreen.fieldAmount")}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
          />

          <Text style={styles.fieldLabel}>
            {t("historicalRecords.periodEndLabel")}
          </Text>
          <TextInput
            style={styles.input}
            value={periodEnd}
            onChangeText={setPeriodEnd}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>{t("financeScreen.fieldNote")}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => setMode("choice")}>
              <Text style={styles.secondaryBtnText}>{t("financeScreen.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => quickTotalMut.mutate()}
              disabled={quickTotalMut.isPending}
            >
              {quickTotalMut.isPending ? (
                <ActivityIndicator color={mobileColors.background} />
              ) : (
                <Text style={styles.primaryBtnText}>{t("financeScreen.save")}</Text>
              )}
            </Pressable>
          </View>
        </ScreenSection>
      ) : null}

      {mode === "import" ? (
        <ScreenSection title={t("historicalRecords.importTitle")}>
          <Text style={styles.hint}>{t("historicalRecords.importFormat")}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => importPreviewMut.mutate()}
            disabled={importPreviewMut.isPending}
          >
            {importPreviewMut.isPending ? (
              <ActivityIndicator color={mobileColors.background} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("historicalRecords.pickFile")}
              </Text>
            )}
          </Pressable>

          {importPreview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>
                {t("historicalRecords.previewTitle", {
                  valid: importPreview.valid_rows.length,
                  invalid: importPreview.invalid_rows.length
                })}
              </Text>
              <Text style={styles.previewLine}>
                {t("historicalRecords.previewIncome")}:{" "}
                {money(importPreview.summary.total_income)}
              </Text>
              <Text style={styles.previewLine}>
                {t("historicalRecords.previewExpense")}:{" "}
                {money(importPreview.summary.total_expense)}
              </Text>
              {importPreview.invalid_rows.length > 0 ? (
                <Text style={styles.previewWarn}>
                  {t("historicalRecords.previewInvalidHint")}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setImportPreview(null);
                    setMode("choice");
                  }}
                >
                  <Text style={styles.secondaryBtnText}>
                    {t("financeScreen.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => importConfirmMut.mutate()}
                  disabled={
                    importConfirmMut.isPending ||
                    importPreview.valid_rows.length === 0
                  }
                >
                  {importConfirmMut.isPending ? (
                    <ActivityIndicator color={mobileColors.background} />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {t("historicalRecords.confirmImport")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {!importPreview ? (
            <Pressable style={styles.secondaryBtn} onPress={() => setMode("choice")}>
              <Text style={styles.secondaryBtnText}>{t("financeScreen.cancel")}</Text>
            </Pressable>
          ) : null}
        </ScreenSection>
      ) : null}
    </ScrollView>
  );
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "positive" | "negative";
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        tone === "positive" ? styles.summaryPositive : styles.summaryNegative
      ]}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  scroll: { padding: mobileSpacing.md, paddingBottom: mobileSpacing.xl },
  summaryGrid: { gap: mobileSpacing.sm },
  summaryCard: {
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    ...mobileShadows.card
  },
  summaryPositive: { backgroundColor: producerColors.successMintBg },
  summaryNegative: { backgroundColor: producerColors.errorSoftBg },
  summaryLabel: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  summaryValue: { ...mobileTypography.cardTitle, marginTop: 4 },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  choiceBtn: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    ...mobileShadows.card
  },
  choiceTitle: { ...mobileTypography.cardTitle },
  choiceBody: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  empty: { ...mobileTypography.body, color: mobileColors.textSecondary },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  recordMain: { flex: 1 },
  recordCat: { ...mobileTypography.cardTitle },
  recordMeta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  recordAmount: { ...mobileTypography.cardTitle },
  amountPositive: { color: mobileColors.success },
  amountNegative: { color: mobileColors.error },
  deleteLink: { color: mobileColors.error, ...mobileTypography.meta },
  segmentRow: { flexDirection: "row", gap: mobileSpacing.sm, marginBottom: mobileSpacing.md },
  segment: {
    flex: 1,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center"
  },
  segmentActive: { backgroundColor: mobileColors.accent },
  segmentText: { ...mobileTypography.body },
  segmentTextActive: { color: mobileColors.onAccent, fontWeight: "600" },
  fieldLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.sm
  },
  input: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.sm,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.sm,
    ...mobileTypography.body
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: mobileSpacing.xs, paddingVertical: mobileSpacing.xs },
  chip: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  chipActive: { backgroundColor: mobileColors.accent },
  chipText: { ...mobileTypography.meta },
  chipTextActive: { color: mobileColors.onAccent },
  actionRow: { flexDirection: "row", gap: mobileSpacing.sm, marginTop: mobileSpacing.md },
  primaryBtn: {
    flex: 1,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  primaryBtnText: { color: mobileColors.onAccent, fontWeight: "600" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryBtnText: { ...mobileTypography.cardTitle },
  previewBox: {
    marginTop: mobileSpacing.md,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md
  },
  previewTitle: { ...mobileTypography.cardTitle, marginBottom: mobileSpacing.sm },
  previewLine: { ...mobileTypography.body, marginBottom: 4 },
  previewWarn: { ...mobileTypography.meta, color: mobileColors.warning, marginTop: mobileSpacing.sm }
});
