import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useSession } from "../../context/SessionContext";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  createMarketplaceListing,
  fetchFarmAnimals,
  fetchFarms
} from "../../lib/api";
import {
  buildMarketplaceListingPayload,
  EMPTY_MARKETPLACE_LISTING_FORM,
  usesFlatListingPrice,
  type MarketplaceListingFormValues
} from "../../lib/marketplaceListingForm";
import { marketplaceActionErrorMessage } from "../../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";
import { MarketplaceListingFormFields } from "./MarketplaceListingFormFields";
import { PhotoUploadGrid } from "./PhotoUploadGrid";

type Props = {
  visible: boolean;
  initialFarmId?: string | null;
  lockFarm?: boolean;
  onClose: () => void;
  onCreated: (listing: { id: string; title: string }) => void;
};

export function CreateMarketplaceListingModal({
  visible,
  initialFarmId,
  lockFarm,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [values, setValues] = useState<MarketplaceListingFormValues>({
    ...EMPTY_MARKETPLACE_LISTING_FORM,
    farmId: initialFarmId ?? null
  });

  useEffect(() => {
    if (visible) {
      setValues({
        ...EMPTY_MARKETPLACE_LISTING_FORM,
        farmId: initialFarmId ?? null
      });
    }
  }, [visible, initialFarmId]);

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const animalsQ = useQuery({
    queryKey: ["farmAnimals", values.farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, values.farmId!, activeProfileId),
    enabled: Boolean(visible && values.farmId && accessToken)
  });

  const mut = useMutation({
    mutationFn: () =>
      createMarketplaceListing(
        accessToken!,
        buildMarketplaceListingPayload(values, t),
        activeProfileId
      ),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      onCreated({ id: created.id, title: created.title });
      onClose();
    },
    onError: (e: Error) =>
      Alert.alert(
        t("marketScreen.createForm.errorTitle"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const handleClose = () => {
    if (mut.isPending) {
      return;
    }
    onClose();
  };

  const flatPrice = usesFlatListingPrice(values.category);
  const canSubmit =
    Boolean(values.title.trim()) &&
    Boolean(values.totalPrice.trim()) &&
    (flatPrice || Boolean(values.totalWeightKg.trim())) &&
    (flatPrice || Boolean(values.pricePerKg.trim())) &&
    (!values.farmId || values.selectedAnimalIds.length > 0);

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title={t("marketScreen.createForm.titleModal")}
      sheetMaxHeight="92%"
      footerPrimary={
        <Pressable
          style={[styles.submit, mut.isPending && styles.submitDisabled]}
          disabled={mut.isPending || !canSubmit}
          onPress={() => mut.mutate()}
        >
          <Text style={styles.submitTx}>
            {mut.isPending
              ? t("marketScreen.createForm.submitting")
              : t("marketScreen.createForm.submit")}
          </Text>
        </Pressable>
      }
    >
      <PhotoUploadGrid
        farmId={values.farmId}
        photoUrls={values.photoUrls}
        onChange={(photoUrls) => setValues((v) => ({ ...v, photoUrls }))}
        animals={animalsQ.data ?? []}
        selectedAnimalIds={values.selectedAnimalIds}
      />
      <MarketplaceListingFormFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        farms={farmsQ.data ?? []}
        animals={animalsQ.data ?? []}
        farmsLoading={farmsQ.isPending}
        animalsLoading={animalsQ.isPending}
        lockFarm={lockFarm}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  submit: {
    backgroundColor: mobileColors.accent,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    minHeight: 48
  },
  submitDisabled: { opacity: 0.55 },
  submitTx: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  }
});
