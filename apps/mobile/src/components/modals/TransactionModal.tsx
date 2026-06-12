import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "./BaseModal";
import { ModalSection } from "./ModalSection";
import { useModal } from "./useModal";
import type { TransactionModalPayload } from "../../context/ModalContext";
import { getSupabase } from "../../lib/supabase";
import { uploadFinanceProofToSupabase } from "../../lib/uploadFinanceProofToSupabase";
import { FinanceCategoryGrid } from "../finance/FinanceCategoryGrid";
import {
  fetchFarmAnimals,
  fetchFarmFeedTypes,
  postFinanceTransaction,
  postFinanceTransactionWithStock,
  type AnimalListItem
} from "../../lib/api";
import {
  FinanceStockLinesEditor,
  stockLinesToPayload,
  type StockLineForm
} from "../finance/FinanceStockLinesEditor";
import { isoDateWithLocalTime } from "../../lib/dateTime";
import { invalidateFarmFinanceQueries } from "../../lib/invalidateFarmFinanceQueries";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";
import { optimisticFinanceTransaction } from "../../lib/offline/optimistic";
import { isOfflineQueuedResult } from "../../lib/offline/types";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  payload: TransactionModalPayload;
  onClose: () => void;
};

type LinkKind = "none" | "batch" | "animal";

export function TransactionModal({ visible, payload, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { open } = useModal();

  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txLabel, setTxLabel] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txRef, setTxRef] = useState(payload.transactionRef);
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<LinkKind>("none");
  const [linkBatchId, setLinkBatchId] = useState<string>("");
  const [linkAnimalId, setLinkAnimalId] = useState<string>("");
  const [recordStock, setRecordStock] = useState(true);
  const [stockLines, setStockLines] = useState<StockLineForm[]>([]);

  const selectedCategory = useMemo(
    () => payload.categories.find((c) => c.id === txCategoryId),
    [payload.categories, txCategoryId]
  );
  const isFeedExpense = txType === "expense" && selectedCategory?.key === "feed";

  const feedTypesQuery = useQuery({
    queryKey: ["farmFeedTypes", payload.farmId, payload.activeProfileId, "txModal"],
    queryFn: () =>
      fetchFarmFeedTypes(payload.accessToken, payload.farmId, payload.activeProfileId),
    enabled: visible && isFeedExpense && Boolean(payload.accessToken)
  });
  const feedTypes = feedTypesQuery.data ?? [];


  useEffect(() => {
    if (visible) {
      setTxType("expense");
      setTxCategoryId("");
      setTxAmount("");
      setTxLabel("");
      setTxDate(new Date().toISOString().slice(0, 10));
      setTxRef(payload.transactionRef);
      setProofPhotoUri(null);
      setLinkKind("none");
      setLinkBatchId("");
      setLinkAnimalId("");
      setRecordStock(true);
      setStockLines([]);
    }
  }, [visible, payload.transactionRef]);

  useEffect(() => {
    if (!isFeedExpense) {
      return;
    }
    setRecordStock(true);
    if (stockLines.length === 0 && feedTypes.length > 0) {
      setStockLines([
        {
          key: "l-0",
          feedTypeId: feedTypes[0].id,
          newFeedName: "",
          newFeedMode: false,
          quantity: "",
          quantityUnit:
            feedTypes[0].unit === "kg" || feedTypes[0].unit === "tonne"
              ? "kg"
              : "sac",
          unitPrice: "",
          weightPerBagKg: feedTypes[0].weightPerBagKg
            ? String(feedTypes[0].weightPerBagKg)
            : "",
          supplier: ""
        }
      ]);
    }
  }, [isFeedExpense, feedTypes, stockLines.length]);

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", payload.farmId, payload.activeProfileId, "txModal"],
    queryFn: () =>
      fetchFarmAnimals(
        payload.accessToken,
        payload.farmId,
        payload.activeProfileId
      ),
    enabled: visible && Boolean(payload.accessToken && payload.farmId)
  });

  const categoriesForType = useMemo(
    () => payload.categories.filter((c) => c.type === txType),
    [payload.categories, txType]
  );

  const pickProofPhoto = useCallback(async (source: "library" | "camera") => {
    const perm =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result =
      source === "library"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.82,
            allowsMultipleSelection: false
          })
        : await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!result.canceled && result.assets[0]?.uri) {
      setProofPhotoUri(result.assets[0].uri);
    }
  }, []);

  const openProofMenu = useCallback(() => {
    Alert.alert(t("financeScreen.proofHint"), undefined, [
      { text: t("financeScreen.cancel"), style: "cancel" },
      {
        text: t("producer.pickGallery"),
        onPress: () => void pickProofPhoto("library")
      },
      {
        text: t("producer.pickCamera"),
        onPress: () => void pickProofPhoto("camera")
      }
    ]);
  }, [t, pickProofPhoto]);

  const buildTxBody = (attachmentUrl?: string) => {
    const note = t("financeScreen.noteRef", { ref: txRef });
    const linkedEntityType =
      linkKind === "batch" && linkBatchId
        ? "batch"
        : linkKind === "animal" && linkAnimalId
          ? "animal"
          : undefined;
    const linkedEntityId =
      linkedEntityType === "batch"
        ? linkBatchId
        : linkedEntityType === "animal"
          ? linkAnimalId
          : undefined;
    return {
      type: txType,
      financeCategoryId: txCategoryId || undefined,
      amount: Number(txAmount.replace(",", ".")),
      label: txLabel.trim(),
      occurredAt: isoDateWithLocalTime(txDate),
      attachmentUrl,
      note,
      linkedEntityType,
      linkedEntityId
    };
  };

  const postTx = useOfflineMutation({
    farmId: payload.farmId,
    type: "finance.postTransaction",
    label: txLabel.trim() || t("financeScreen.newTransaction"),
    mutationFn: async () => {
      let attachmentUrl: string | undefined;
      if (proofPhotoUri) {
        const supabase = getSupabase();
        if (!supabase) {
          throw new Error(t("financeScreen.proofNoSupabase"));
        }
        const mime =
          proofPhotoUri.toLowerCase().endsWith(".png") ||
          proofPhotoUri.includes("png")
            ? "image/png"
            : "image/jpeg";
        try {
          attachmentUrl = await uploadFinanceProofToSupabase(
            supabase,
            payload.farmId,
            txRef,
            proofPhotoUri,
            mime
          );
        } catch {
          throw new Error(t("financeScreen.proofUploadError"));
        }
      }
      const amount = Number(txAmount.replace(",", "."));
      const note = t("financeScreen.noteRef", { ref: txRef });
      if (isFeedExpense && recordStock) {
        const lines = stockLinesToPayload(stockLines, feedTypes);
        if (lines.length > 0) {
          return postFinanceTransactionWithStock(
            payload.accessToken,
            payload.farmId,
            {
              amount,
              currency: payload.currencyCode,
              label: txLabel.trim(),
              financeCategoryId: txCategoryId || undefined,
              occurredAt: isoDateWithLocalTime(txDate),
              note,
              attachmentUrl,
              recordStock: true,
              stockLines: lines
            },
            payload.activeProfileId
          );
        }
      }
      return postFinanceTransaction(
        payload.accessToken,
        payload.farmId,
        buildTxBody(attachmentUrl),
        payload.activeProfileId
      );
    },
    buildOfflineItem: () => {
      const mime =
        proofPhotoUri &&
        (proofPhotoUri.toLowerCase().endsWith(".png") ||
          proofPhotoUri.includes("png"))
          ? "image/png"
          : "image/jpeg";
      return {
        calls: [
          {
            method: "POST",
            path: `/farms/${payload.farmId}/finance/transactions`,
            body: buildTxBody(undefined)
          }
        ],
        invalidateRoots: [
          "financeOverview",
          "financeTransactions",
          "financeReport",
          "farmFeed"
        ],
        localProofUri: proofPhotoUri ?? undefined,
        proofMeta: proofPhotoUri
          ? {
              farmId: payload.farmId,
              txRef,
              mime
            }
          : undefined
      };
    },
    applyOptimistic: (_v, queueItemId) => {
      optimisticFinanceTransaction(
        qc,
        payload.farmId,
        queueItemId,
        buildTxBody(undefined)
      );
    },
    onSuccess: (data) => {
      invalidateFarmFinanceQueries(qc, payload.farmId);
      onClose();
      setTimeout(() => {
        open("success", {
          message: isOfflineQueuedResult(data)
            ? offlineQueuedMessage(t)
            : t("financeScreen.txSuccessMessage"),
          autoDismissMs: 2000
        });
      }, 0);
    },
    onQueued: () => {
      invalidateFarmFinanceQueries(qc, payload.farmId);
      onClose();
      setTimeout(() => {
        open("success", {
          message: offlineQueuedMessage(t),
          autoDismissMs: 2600
        });
      }, 0);
    },
    onError: (e: Error) =>
      Alert.alert(t("financeScreen.errorTitle"), getUserFacingError(e, t))
  });

  const headerAmountPreview =
    txAmount.trim() && Number.isFinite(Number(txAmount.replace(",", ".")))
      ? `${payload.currencySymbol || payload.currencyCode} ${txAmount.trim()}`
      : undefined;

  const animals = (animalsQuery.data ?? []) as AnimalListItem[];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("financeScreen.modalTitle")}
      headerAmount={headerAmountPreview}
      footerPrimary={
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.linkTx}>{t("financeScreen.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!txLabel.trim() || !txAmount.trim()) {
                Alert.alert(
                  t("financeScreen.requiredTitle"),
                  t("financeScreen.requiredBody")
                );
                return;
              }
              postTx.mutate();
            }}
            disabled={postTx.isPending}
          >
            {postTx.isPending ? (
              <ActivityIndicator size="small" color={mobileColors.accent} />
            ) : (
              <Text style={styles.primaryTx}>{t("financeScreen.create")}</Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ModalSection title={t("modals.sections.reference")}>
        <Text style={styles.fieldLab}>{t("financeScreen.transactionRef")}</Text>
        <View style={styles.refBox}>
          <Text style={styles.refValue} selectable>
            {txRef || "—"}
          </Text>
        </View>
        <Text style={styles.refHint}>{t("financeScreen.transactionRefHint")}</Text>
      </ModalSection>

      <ModalSection title={t("modals.sections.category")}>
      <View style={styles.rowBtns}>
        <Pressable
          style={[styles.chip, txType === "expense" && styles.chipOn]}
          onPress={() => {
            setTxType("expense");
            setTxCategoryId("");
          }}
        >
          <Text style={styles.chipTx}>{t("financeScreen.expense")}</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, txType === "income" && styles.chipOn]}
          onPress={() => {
            setTxType("income");
            setTxCategoryId("");
          }}
        >
          <Text style={styles.chipTx}>{t("financeScreen.income")}</Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLab}>{t("financeScreen.fieldCategory")}</Text>
      <FinanceCategoryGrid
        categories={categoriesForType}
        selectedId={txCategoryId}
        onSelect={setTxCategoryId}
      />
      </ModalSection>

      <ModalSection title={t("modals.sections.amount")}>
      <Text style={styles.fieldLab}>
        {t("financeScreen.fieldAmount")} ({payload.currencyCode})
      </Text>
      <TextInput
        style={styles.input}
        value={txAmount}
        onChangeText={setTxAmount}
        keyboardType="decimal-pad"
        placeholder={payload.currencySymbol}
      />

      <Text style={styles.fieldLab}>{t("financeScreen.fieldDescription")}</Text>
      <TextInput
        style={styles.input}
        value={txLabel}
        onChangeText={setTxLabel}
        placeholder={t("modals.transaction.descriptionPh")}
      />

      <AppDatePicker
        label={t("financeScreen.fieldDate")}
        isoValue={txDate}
        onIsoChange={setTxDate}
        farmId={payload.farmId}
      />
      </ModalSection>

      {isFeedExpense ? (
        <ModalSection title={t("financeStockLink.stockSectionTitle")}>
          <View style={styles.stockToggleRow}>
            <Text style={styles.fieldLab}>{t("financeStockLink.recordStock")}</Text>
            <Pressable
              style={[styles.chip, recordStock && styles.chipOn]}
              onPress={() => setRecordStock((v) => !v)}
            >
              <Text style={styles.chipTx}>
                {recordStock ? t("common.yes") : t("common.no")}
              </Text>
            </Pressable>
          </View>
          {recordStock ? (
            feedTypesQuery.isPending ? (
              <ActivityIndicator color={mobileColors.accent} />
            ) : (
              <FinanceStockLinesEditor
                types={feedTypes}
                lines={stockLines}
                onChange={setStockLines}
                totalAmount={Number.parseFloat(txAmount.replace(",", ".")) || 0}
                currencyCode={payload.currencyCode}
              />
            )
          ) : null}
        </ModalSection>
      ) : null}

      <ModalSection title={t("modals.sections.link")}>
      <Text style={styles.fieldLab}>{t("modals.transaction.linkSection")}</Text>
      <View style={styles.rowBtns}>
        {(["none", "batch", "animal"] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.chip, linkKind === k && styles.chipOn]}
            onPress={() => {
              setLinkKind(k);
              if (k !== "batch") {
                setLinkBatchId("");
              }
              if (k !== "animal") {
                setLinkAnimalId("");
              }
            }}
          >
            <Text style={styles.chipTx}>
              {k === "none"
                ? t("modals.transaction.linkNone")
                : k === "batch"
                  ? t("modals.transaction.linkBatch")
                  : t("modals.transaction.linkAnimal")}
            </Text>
          </Pressable>
        ))}
      </View>

      {linkKind === "batch" ? (
        <>
          <Text style={styles.fieldLab}>{t("modals.transaction.pickBatch")}</Text>
          <ScrollView style={styles.catScroll} nestedScrollEnabled>
            {payload.batches.map((b) => (
              <Pressable
                key={b.id}
                style={[styles.catRow, linkBatchId === b.id && styles.catRowOn]}
                onPress={() => setLinkBatchId(b.id)}
              >
                <Text>{b.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {linkKind === "animal" ? (
        <>
          <Text style={styles.fieldLab}>{t("modals.transaction.pickAnimal")}</Text>
          <ScrollView style={styles.catScroll} nestedScrollEnabled>
            {animalsQuery.isPending ? (
              <ActivityIndicator />
            ) : (
              animals.map((a) => (
                <Pressable
                  key={a.id}
                  style={[styles.catRow, linkAnimalId === a.id && styles.catRowOn]}
                  onPress={() => setLinkAnimalId(a.id)}
                >
                  <Text>{a.tagCode?.trim() || a.publicId.slice(0, 10)}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </>
      ) : null}
      </ModalSection>

      <ModalSection title={t("modals.sections.proof")}>
      <Text style={styles.fieldLab}>{t("financeScreen.proofHint")}</Text>
      {proofPhotoUri ? (
        <View style={styles.proofPreviewWrap}>
          <Image
            source={{ uri: proofPhotoUri }}
            style={styles.proofPreview}
            resizeMode="cover"
          />
          <View style={styles.proofBtnRow}>
            <TouchableOpacity onPress={openProofMenu}>
              <Text style={styles.linkTx}>{t("financeScreen.changeProofPhoto")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProofPhotoUri(null)}>
              <Text style={styles.dangerLink}>{t("financeScreen.removeProofPhoto")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.proofAddBtn} onPress={openProofMenu}>
          <Text style={styles.proofAddBtnTx}>{t("financeScreen.addProofPhoto")}</Text>
        </TouchableOpacity>
      )}
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  fieldLab: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  refBox: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  refValue: {
    ...mobileTypography.body,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: mobileColors.textPrimary
  },
  refHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs,
    marginBottom: mobileSpacing.sm
  },
  rowBtns: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    flexWrap: "wrap",
    marginBottom: mobileSpacing.xs
  },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  chipTx: {
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  catScroll: { maxHeight: 160, marginBottom: mobileSpacing.sm },
  catRow: {
    padding: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  catRowOn: { backgroundColor: mobileColors.accentSoft },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.xs,
    color: mobileColors.textPrimary
  },
  proofPreviewWrap: { marginBottom: mobileSpacing.sm },
  proofPreview: {
    width: "100%",
    height: 160,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  proofBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  proofAddBtn: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderStyle: "dashed",
    paddingVertical: mobileSpacing.md,
    alignItems: "center",
    marginBottom: mobileSpacing.sm
  },
  proofAddBtnTx: {
    color: mobileColors.accent,
    fontWeight: "700"
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  linkTx: {
    color: mobileColors.accent,
    fontWeight: "700"
  },
  dangerLink: { color: mobileColors.error, fontWeight: "700" },
  stockToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: mobileSpacing.sm },
  primaryTx: {
    color: mobileColors.accent,
    fontWeight: "800",
    fontSize: 16
  }
});
