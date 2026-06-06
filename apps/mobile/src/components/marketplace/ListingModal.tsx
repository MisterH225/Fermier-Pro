import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  createMarketplaceListing,
  fetchFarmAnimals,
  fetchFarms,
  fetchMarketplaceListing,
  renewMarketplaceListing,
  updateMarketplaceListing,
  type MarketplaceListingListItem
} from "../../lib/api";
import {
  buildMarketplaceListingPayload,
  buildUpdateMarketplaceListingPayload,
  EMPTY_MARKETPLACE_LISTING_FORM,
  filterSelectableAnimalIds,
  listingToFormValues,
  usesFlatListingPrice,
  type MarketplaceListingFormValues
} from "../../lib/marketplaceListingForm";
import { marketplaceActionErrorMessage } from "../../lib/marketplaceLabels";
import { getSupabase } from "../../lib/supabase";
import { deleteListingPhotoFromSupabase } from "../../lib/uploadListingPhotoToSupabase";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";
import { useModal } from "../modals/useModal";
import { MarketplaceListingFormFields } from "./MarketplaceListingFormFields";
import { PhotoUploadGrid } from "./PhotoUploadGrid";

export type ListingModalMode = "create" | "edit";

type Props = {
  visible: boolean;
  mode: ListingModalMode;
  /** Obligatoire en mode édition. */
  listingId?: string;
  initialFarmId?: string | null;
  lockFarm?: boolean;
  onClose: () => void;
  onSuccess: (listing: { id: string; title: string }) => void;
};

export function ListingModal({
  visible,
  mode,
  listingId,
  initialFarmId,
  lockFarm,
  onClose,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const isEdit = mode === "edit";
  const syncedRef = useRef(false);
  const initialPhotoUrlsRef = useRef<string[]>([]);

  const [values, setValues] = useState<MarketplaceListingFormValues>({
    ...EMPTY_MARKETPLACE_LISTING_FORM,
    farmId: initialFarmId ?? null
  });
  const [extendDuration, setExtendDuration] = useState(false);

  const listingQ = useQuery({
    queryKey: ["marketplaceListing", listingId, activeProfileId],
    queryFn: () => fetchMarketplaceListing(accessToken!, listingId!, activeProfileId),
    enabled: Boolean(visible && isEdit && listingId && accessToken)
  });

  useEffect(() => {
    if (!visible) {
      syncedRef.current = false;
      return;
    }
    if (isEdit) {
      return;
    }
    setValues({
      ...EMPTY_MARKETPLACE_LISTING_FORM,
      farmId: initialFarmId ?? null
    });
    setExtendDuration(false);
    initialPhotoUrlsRef.current = [];
  }, [visible, isEdit, initialFarmId]);

  useEffect(() => {
    if (!visible || !isEdit || !listingQ.data || syncedRef.current) {
      return;
    }
    syncedRef.current = true;
    const next = listingToFormValues(listingQ.data);
    initialPhotoUrlsRef.current = [...next.photoUrls];
    setValues(next);
    setExtendDuration(false);
  }, [visible, isEdit, listingQ.data]);

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

  useEffect(() => {
    if (!visible || !isEdit || !animalsQ.data?.length) {
      return;
    }
    setValues((prev) => {
      const filtered = filterSelectableAnimalIds(
        prev.selectedAnimalIds,
        animalsQ.data ?? []
      );
      if (
        filtered.length === prev.selectedAnimalIds.length &&
        filtered.every((id, i) => id === prev.selectedAnimalIds[i])
      ) {
        return prev;
      }
      return {
        ...prev,
        selectedAnimalIds: filtered,
        animalId: filtered.length === 1 ? filtered[0]! : (filtered[0] ?? null)
      };
    });
  }, [visible, isEdit, animalsQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        throw new Error("Session expirée.");
      }
      if (isEdit) {
        if (!listingId) {
          throw new Error("Annonce introuvable.");
        }
        const removed = initialPhotoUrlsRef.current.filter(
          (url) => !values.photoUrls.includes(url)
        );
        const supabase = getSupabase();
        if (supabase && removed.length > 0) {
          await Promise.all(
            removed.map((url) =>
              deleteListingPhotoFromSupabase(supabase, url).catch(() => undefined)
            )
          );
        }
        const updated = await updateMarketplaceListing(
          accessToken,
          listingId,
          buildUpdateMarketplaceListingPayload(values, t),
          activeProfileId
        );
        const listing = listingQ.data;
        if (
          extendDuration &&
          listing &&
          (listing.status === "published" || listing.status === "expired")
        ) {
          return renewMarketplaceListing(
            accessToken,
            listingId,
            values.publishDurationDays,
            activeProfileId
          );
        }
        return updated;
      }
      return createMarketplaceListing(
        accessToken,
        buildMarketplaceListingPayload(values, t),
        activeProfileId
      );
    },
    onSuccess: (saved: MarketplaceListingListItem) => {
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      if (isEdit && listingId) {
        void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      }
      onSuccess({ id: saved.id, title: saved.title });
      onClose();
      open("success", {
        message: isEdit
          ? t("marketScreen.editForm.success", {
              defaultValue: "Annonce mise à jour."
            })
          : t("marketScreen.createForm.draftSuccess", {
              defaultValue: "Brouillon enregistré."
            }),
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        isEdit
          ? t("marketScreen.editForm.errorTitle", {
              defaultValue: "Modification impossible"
            })
          : t("marketScreen.createForm.errorTitle"),
        marketplaceActionErrorMessage(e, t)
      )
  });

  const handleClose = () => {
    if (saveMut.isPending) {
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

  const title = isEdit
    ? t("marketScreen.editForm.titleModal", { defaultValue: "Modifier l'annonce" })
    : t("marketScreen.createForm.titleModal");

  const submitLabel = saveMut.isPending
    ? t("marketScreen.createForm.submitting")
    : isEdit
      ? t("marketScreen.editForm.submit", {
          defaultValue: "Enregistrer les modifications"
        })
      : t("marketScreen.createForm.submit");

  const listingLoading = isEdit && listingQ.isPending;
  const listingError =
    isEdit && listingQ.error instanceof Error
      ? listingQ.error.message
      : isEdit &&
          listingQ.data &&
          (listingQ.data.status === "sold" ||
            listingQ.data.status === "cancelled")
        ? t("marketScreen.editForm.closedListing", {
            defaultValue: "Cette annonce est clôturée et ne peut plus être modifiée."
          })
        : null;

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title={title}
      sheetMaxHeight="92%"
      footerPrimary={
        <Pressable
          style={[styles.submit, saveMut.isPending && styles.submitDisabled]}
          disabled={saveMut.isPending || !canSubmit || listingLoading || Boolean(listingError)}
          onPress={() => saveMut.mutate()}
        >
          <Text style={styles.submitTx}>{submitLabel}</Text>
        </Pressable>
      }
    >
      {listingLoading ? (
        <Text style={styles.loadingTx}>
          {t("common.loading", { defaultValue: "Chargement…" })}
        </Text>
      ) : listingError ? (
        <Text style={styles.errorTx}>{listingError}</Text>
      ) : (
        <>
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
            lockFarm={lockFarm || isEdit}
            showDuration={!isEdit}
            editExpiresAt={isEdit ? (listingQ.data?.expiresAt ?? null) : null}
            extendDuration={extendDuration}
            onExtendDurationChange={setExtendDuration}
          />
        </>
      )}
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
  },
  loadingTx: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    paddingVertical: mobileSpacing.lg
  },
  errorTx: {
    ...mobileTypography.body,
    color: mobileColors.error,
    textAlign: "center",
    paddingVertical: mobileSpacing.lg
  }
});
