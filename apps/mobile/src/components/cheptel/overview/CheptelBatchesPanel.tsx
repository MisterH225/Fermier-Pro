import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchFarmBatches, type BatchListItem } from "../../../lib/api";
import { useDeleteFarmBatch } from "../../../hooks/useDeleteFarmBatch";
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

  const batchesQ = useQuery({
    queryKey: ["farmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken, farmId, activeProfileId),
    staleTime: 0
  });

  const { confirmDelete, isDeleting, deletingBatchId } = useDeleteFarmBatch({
    farmId,
    accessToken,
    activeProfileId
  });

  if (batchesQ.isPending) {
    return <ActivityIndicator color={mobileColors.accent} style={styles.loader} />;
  }

  if (batchesQ.isError) {
    return (
      <Text style={styles.error}>
        {getUserFacingError(batchesQ.error, t)}
      </Text>
    );
  }

  const batches = batchesQ.data ?? [];
  if (batches.length === 0) {
    return (
      <Text style={styles.empty}>{t("cheptel.emptyBatches")}</Text>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.hint}>{t("cheptel.batches.listHint")}</Text>
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
                onPress={() => confirmDelete(batch)}
                hitSlop={8}
              >
                {isDeleting && deletingBatchId === batch.id ? (
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
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  error: {
    ...mobileTypography.meta,
    color: mobileColors.error
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
