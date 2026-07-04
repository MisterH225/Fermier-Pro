import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { deleteFarmBatch } from "../lib/api";
import { getUserFacingError } from "../lib/userFacingError";

type BatchRef = { id: string; name: string };

type Options = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onDeleted?: () => void;
};

export function useDeleteFarmBatch({
  farmId,
  accessToken,
  activeProfileId,
  onDeleted
}: Options) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (batchId: string) =>
      deleteFarmBatch(accessToken, farmId, batchId, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmBatches", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
      void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
      void qc.invalidateQueries({ queryKey: ["penContents", farmId] });
      void qc.invalidateQueries({ queryKey: ["batchProfitability", farmId] });
      onDeleted?.();
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.batches.deleteFailed"), getUserFacingError(e, t));
    }
  });

  const confirmDelete = (batch: BatchRef) => {
    Alert.alert(
      t("cheptel.batches.deleteTitle"),
      t("cheptel.batches.deleteBody", { name: batch.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("cheptel.batches.deleteConfirm"),
          style: "destructive",
          onPress: () => mutation.mutate(batch.id)
        }
      ]
    );
  };

  return {
    confirmDelete,
    isDeleting: mutation.isPending,
    deletingBatchId: mutation.variables
  };
}
