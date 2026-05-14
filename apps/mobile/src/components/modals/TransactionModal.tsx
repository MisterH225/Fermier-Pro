import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { BaseModal } from "./BaseModal";
import { useModal } from "./useModal";
import type { TransactionModalPayload } from "../../context/ModalContext";
import { isDemoBypassToken } from "../../lib/demoBypass";
import { getSupabase } from "../../lib/supabase";
import { uploadFinanceProofToSupabase } from "../../lib/uploadFinanceProofToSupabase";
import type { FinanceCategoryDto } from "../../lib/api";
import {
  fetchFarmAnimals,
  postFinanceTransaction,
  type AnimalListItem
} from "../../lib/api";
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
    }
  }, [visible, payload.transactionRef]);

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

  const postTx = useMutation({
    mutationFn: async () => {
      const note = t("financeScreen.noteRef", { ref: txRef });
      let attachmentUrl: string | undefined;
      const token = payload.accessToken;
      if (proofPhotoUri) {
        if (!isDemoBypassToken(token)) {
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
      }
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

      return postFinanceTransaction(
        token,
        payload.farmId,
        {
          type: txType,
          financeCategoryId: txCategoryId || undefined,
          amount: Number(txAmount.replace(",", ".")),
          label: txLabel.trim(),
          occurredAt: `${txDate}T12:00:00.000Z`,
          attachmentUrl,
          note,
          linkedEntityType,
          linkedEntityId
        },
        payload.activeProfileId
      );
    },
    onSuccess: () => {
      const fid = payload.farmId;
      void qc.invalidateQueries({ queryKey: ["financeOverview", fid] });
      void qc.invalidateQueries({ queryKey: ["financeTransactions", fid] });
      void qc.invalidateQueries({ queryKey: ["financeReport", fid] });
      onClose();
      setTimeout(() => {
        open("success", {
          message: t("financeScreen.txSuccessMessage"),
          autoDismissMs: 2000
        });
      }, 0);
    },
    onError: (e: Error) =>
      Alert.alert(t("financeScreen.errorTitle"), e.message)
  });

  const headerAmountPreview =
    txAmount.trim() && Number.isFinite(Number(txAmount.replace(",", ".")))
      ? `${payload.currencySymbol || payload.currencyCode} ${txAmount.trim()}`
      : undefined;

  const secondaryActions = useMemo(
    () => [
      {
        key: "edit",
        icon: "create-outline" as const,
        label: t("modals.transaction.edit"),
        onPress: () =>
          Alert.alert(
            t("modals.transaction.edit"),
            t("modals.transaction.editCreateHint")
          )
      },
      {
        key: "dup",
        icon: "copy-outline" as const,
        label: t("modals.transaction.duplicate"),
        onPress: () =>
          Alert.alert(
            t("modals.transaction.duplicate"),
            t("modals.transaction.duplicateHint")
          )
      },
      {
        key: "del",
        icon: "trash-outline" as const,
        label: t("modals.transaction.delete"),
        onPress: () =>
          Alert.alert(
            t("modals.transaction.delete"),
            t("modals.transaction.deleteCreateHint")
          )
      }
    ],
    [t]
  );

  const animals = (animalsQuery.data ?? []) as AnimalListItem[];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("financeScreen.modalTitle")}
      headerAmount={headerAmountPreview}
      secondaryActions={secondaryActions}
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
      <Text style={styles.fieldLab}>{t("financeScreen.transactionRef")}</Text>
      <View style={styles.refBox}>
        <Text style={styles.refValue} selectable>
          {txRef || "—"}
        </Text>
      </View>
      <Text style={styles.refHint}>{t("financeScreen.transactionRefHint")}</Text>

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
      <ScrollView style={styles.catScroll} nestedScrollEnabled>
        {categoriesForType.map((c: FinanceCategoryDto) => (
          <Pressable
            key={c.id}
            style={[styles.catRow, txCategoryId === c.id && styles.catRowOn]}
            onPress={() => setTxCategoryId(c.id)}
          >
            <Text>
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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

      <Text style={styles.fieldLab}>{t("financeScreen.fieldDate")}</Text>
      <TextInput
        style={styles.input}
        value={txDate}
        onChangeText={setTxDate}
        placeholder="YYYY-MM-DD"
      />

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
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  fieldLab: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
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
  primaryTx: {
    color: mobileColors.accent,
    fontWeight: "800",
    fontSize: 16
  }
});
