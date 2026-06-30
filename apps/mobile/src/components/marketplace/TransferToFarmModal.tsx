import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  fetchFarmBarns,
  fetchFarms,
  type MarketplacePendingTransferDto
} from "../../lib/api";
import { resolvePenOccupancy } from "../../lib/penOccupancy";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  submitting?: boolean;
  pendingTransfer: MarketplacePendingTransferDto;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onConfirm: (payload: { buyerFarmId: string; penId?: string }) => void;
};

type PenOption = {
  penId: string;
  penName: string;
  barnName: string;
};

export function TransferToFarmModal({
  visible,
  submitting,
  pendingTransfer,
  accessToken,
  activeProfileId,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [farmId, setFarmId] = useState<string | null>(
    pendingTransfer.buyerFarmId
  );
  const [penId, setPenId] = useState<string | null>(null);

  const farmsQuery = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken, activeProfileId),
    enabled: visible
  });

  const barnsQuery = useQuery({
    queryKey: ["farmBarns", farmId, activeProfileId],
    queryFn: () => fetchFarmBarns(accessToken, farmId!, activeProfileId),
    enabled: visible && Boolean(farmId)
  });

  const barnIds = useMemo(
    () => (barnsQuery.data ?? []).map((b) => b.id),
    [barnsQuery.data]
  );

  const penQueries = useQuery({
    queryKey: ["transferModalPens", farmId, barnIds.join(","), activeProfileId],
    queryFn: async () => {
      const { fetchFarmBarn } = await import("../../lib/api");
      const details = await Promise.all(
        barnIds.map((barnId) =>
          fetchFarmBarn(accessToken, farmId!, barnId, activeProfileId)
        )
      );
      return details;
    },
    enabled: visible && Boolean(farmId) && barnIds.length > 0
  });

  const penOptions: PenOption[] = useMemo(() => {
    const options: PenOption[] = [];
    for (const barn of penQueries.data ?? []) {
      for (const pen of barn.pens) {
        options.push({
          penId: pen.id,
          penName: pen.name,
          barnName: barn.name
        });
      }
    }
    return options;
  }, [penQueries.data]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setFarmId(pendingTransfer.buyerFarmId);
    setPenId(null);
  }, [visible, pendingTransfer.buyerFarmId]);

  const animalCount = pendingTransfer.animalIds.length;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.transferModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.transferModal.confirm")}
          onPress={() => {
            if (!farmId) {
              return;
            }
            onConfirm({
              buyerFarmId: farmId,
              penId: penId ?? undefined
            });
          }}
          loading={submitting}
          disabled={!farmId}
        />
      }
    >
      <Text style={styles.info}>
        {t("marketScreen.transferModal.info", { count: animalCount })}
      </Text>

      <Text style={styles.label}>{t("marketScreen.transferModal.farm")}</Text>
      {farmsQuery.isLoading ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        <View style={styles.chipRow}>
          {(farmsQuery.data ?? []).map((farm) => (
            <Pressable
              key={farm.id}
              style={[styles.chip, farmId === farm.id && styles.chipOn]}
              onPress={() => {
                setFarmId(farm.id);
                setPenId(null);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  farmId === farm.id && styles.chipTextOn
                ]}
              >
                {farm.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {farmId ? (
        <>
          <Text style={styles.label}>
            {t("marketScreen.transferModal.penOptional")}
          </Text>
          {penQueries.isLoading ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : penOptions.length === 0 ? (
            <Text style={styles.hint}>
              {t("marketScreen.transferModal.noPen")}
            </Text>
          ) : (
            <View style={styles.chipRow}>
              {penOptions.map((pen) => {
                const detailPen = (penQueries.data ?? [])
                  .flatMap((b) => b.pens)
                  .find((p) => p.id === pen.penId);
                const occ = detailPen ? resolvePenOccupancy(detailPen) : 0;
                const cap = detailPen?.capacity ?? 0;
                return (
                  <Pressable
                    key={pen.penId}
                    style={[styles.chip, penId === pen.penId && styles.chipOn]}
                    onPress={() =>
                      setPenId(penId === pen.penId ? null : pen.penId)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        penId === pen.penId && styles.chipTextOn
                      ]}
                    >
                      {pen.barnName} — {pen.penName}
                      {cap > 0 ? ` (${occ}/${cap})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  info: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs,
    marginTop: mobileSpacing.sm
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  chip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.surfaceMuted
  },
  chipText: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary
  },
  chipTextOn: {
    color: mobileColors.accent,
    fontWeight: "600"
  }
});
