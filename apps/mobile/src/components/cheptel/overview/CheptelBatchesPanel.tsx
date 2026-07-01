import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteFarmBatch,
  fetchFarmBatches,
  type BatchListItem
} from "../../../lib/api";
import { getUserFacingError } from "../../../lib/userFacingError";
import type { RootStackParamList } from "../../../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId?: string | null;
  readOnly?: boolean;
};

function isBatchDeletable(batch: BatchListItem): boolean {
  return batch.headcount <= 0;
}

export function CheptelBatchesPanel({
  farmId,
  farmName,
  accessToken,
  activeProfileId,
  readOnly = false
}: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const batchesQ = useQuery({
    queryKey: ["farmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken, farmId, activeProfileId)
  });

  const deleteMut = useMutation({
    mutationFn: (batchId: string) =>
      deleteFarmBatch(accessToken, farmId, batchId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
      void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
      void qc.invalidateQueries({ queryKey: ["batchProfitability", farmId] });
    }
  });

  const confirmDelete = (batch: BatchListItem) => {
    Alert.alert(
      t("cheptel.batches.deleteTitle"),
      t("cheptel.batches.deleteBody", { name: batch.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("cheptel.batches.deleteConfirm"),
          style: "destructive",
          onPress: () => {
            deleteMut.mutate(batch.id, {
              onError: (e: Error) =>
                Alert.alert(
                  t("common.errors.saveFailed"),
                  getUserFacingError(e, t)
                )
            });
          }
        }
      ]
    );
  };

  const batches = batchesQ.data ?? [];
  if (batchesQ.isPending) {
    return <ActivityIndicator color={mobileColors.accent} style={styles.loader} />;
  }
  if (batches.length === 0) {
    return (
      <Text style={styles.empty}>{t("cheptel.emptyBatches")}</Text>
    );
  }

  return (
    <View style={styles.list}>
      {batches.map((batch) => {
        const deletable = isBatchDeletable(batch);
        return (
          <Pressable
            key={batch.id}
            style={styles.row}
            onPress={() =>
              navigation.navigate("BatchDetail", {
                farmId,
                farmName,
                batchId: batch.id,
                batchName: batch.name
              })
            }
          >
            <View style={styles.rowMain}>
              <Text style={styles.name} numberOfLines={2}>
                {batch.name}
              </Text>
              <Text style={styles.meta}>
                {batch.headcount} {t("health.diseases.unitSubjects")}
                {" · "}
                {batch.status}
              </Text>
            </View>
            {!readOnly && deletable ? (
              <Pressable
                style={styles.deleteBtn}
                accessibilityLabel={t("cheptel.batches.deleteA11y")}
                onPress={(e) => {
                  e.stopPropagation?.();
                  confirmDelete(batch);
                }}
                hitSlop={8}
              >
                {deleteMut.isPending && deleteMut.variables === batch.id ? (
                  <ActivityIndicator size="small" color={mobileColors.error} />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={mobileColors.error}
                  />
                )}
              </Pressable>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={mobileColors.textSecondary}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: mobileSpacing.md },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  list: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md
  },
  rowMain: { flex: 1, minWidth: 0 },
  name: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  deleteBtn: {
    padding: 4
  }
});
