import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { BatchListItem } from "../../../lib/api";
import { EventList, type EventItem } from "../../lists";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { AnimalDetailModal } from "./AnimalDetailModal";
import { ChangeStatusModal } from "./ChangeStatusModal";
import { CreateAnimalModal } from "./CreateAnimalModal";
import { BulkAddAnimalsModal } from "./BulkAddAnimalsModal";
import { SaleModal } from "./SaleModal";
import type { SaleResult } from "./SaleModal";
import { DiseaseModal } from "../../shared/DiseaseModal";
import { TransferModal } from "./TransferModal";
import {
  animalToEventItem,
  filterAnimals,
  type AnimalFilterId
} from "./animalUtils";
import type { AnimalListItem } from "../../../lib/api";
import { useModal } from "../../modals/useModal";

type Props = {
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId?: string | null;
  animals: AnimalListItem[];
  batches: BatchListItem[];
  showBatches: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  onInvalidate: () => void;
  onOpenBatch: (batch: BatchListItem) => void;
  onOpenAnimalScreen: (animal: AnimalListItem) => void;
  onOpenHealth?: (animal: AnimalListItem) => void;
  modeHint?: React.ReactNode;
};

export function AnimalList({
  farmId,
  accessToken,
  activeProfileId,
  animals,
  batches,
  showBatches,
  isLoading,
  onRefresh,
  refreshing,
  onInvalidate,
  onOpenBatch,
  onOpenAnimalScreen,
  onOpenHealth,
  modeHint
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [filterId, setFilterId] = useState<AnimalFilterId>("active");
  const [search, setSearch] = useState("");
  const [detailAnimal, setDetailAnimal] = useState<AnimalListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [saleAnimal, setSaleAnimal] = useState<AnimalListItem | null>(null);
  const [diseaseAnimal, setDiseaseAnimal] = useState<AnimalListItem | null>(null);
  const [transferAnimalId, setTransferAnimalId] = useState<string | null>(null);

  const filters = useMemo(
    () => [
      { id: "all", label: t("cheptel.animals.filter.all") },
      { id: "male", label: t("cheptel.animals.filter.male") },
      { id: "female", label: t("cheptel.animals.filter.female") },
      { id: "active", label: t("cheptel.animals.filter.active") },
      { id: "sold", label: t("cheptel.animals.filter.sold") },
      { id: "dead", label: t("cheptel.animals.filter.dead") },
      { id: "reformed", label: t("cheptel.animals.filter.reformed") }
    ],
    [t]
  );

  const filtered = useMemo(
    () => filterAnimals(animals, filterId, search),
    [animals, filterId, search]
  );

  const events = useMemo((): EventItem[] => {
    return filtered.map((a) =>
      animalToEventItem(a, {
        status: (s) => t(`cheptel.animals.status.${s}`),
        noPen: t("cheptel.animals.noPen"),
        penLine: (barn, pen) => `${barn} · ${pen}`
      })
    );
  }, [filtered, t]);

  const onItemPress = useCallback((item: EventItem) => {
    const a = item.meta as AnimalListItem;
    setDetailAnimal(a);
  }, []);

  const searchBar = (
    <TextInput
      style={styles.search}
      value={search}
      onChangeText={setSearch}
      placeholder={t("cheptel.animals.searchPlaceholder")}
      placeholderTextColor={mobileColors.textSecondary}
      clearButtonMode="while-editing"
    />
  );

  const batchesBlock =
    showBatches && batches.length > 0 ? (
      <View style={styles.batchesBlock}>
        <Text style={styles.batchesTitle}>{t("cheptel.growthBatches")}</Text>
        {batches.map((b) => (
          <Pressable
            key={b.id}
            style={styles.batchCard}
            onPress={() => onOpenBatch(b)}
          >
            <Text style={styles.batchTitle}>
              {b.name} · {b.headcount} {t("cheptel.animals.heads")}
            </Text>
            <Text style={styles.batchSub}>{b.status}</Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <>
      {modeHint}
      {searchBar}
      <EventList
        layout="embedded"
        data={events}
        filters={filters}
        activeFilterId={filterId}
        onFilterChange={(id) => setFilterId(id as AnimalFilterId)}
        onItemPress={onItemPress}
        onAddPress={() => setCreateOpen(true)}
        sectionTitle={t("cheptel.navAnimals")}
        isLoading={isLoading}
        emptyMessage={t("cheptel.emptyAnimals")}
        refreshing={refreshing}
        onRefresh={onRefresh}
        pageSize={25}
        loadMoreLabel={t("cheptel.loadMore")}
        prependContent={batchesBlock}
      />

      <Pressable
        style={styles.fab}
        onPress={() => setCreateOpen(true)}
        onLongPress={() => setBulkOpen(true)}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={t("cheptel.animals.addFab")}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <AnimalDetailModal
        visible={Boolean(detailAnimal)}
        animal={detailAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setDetailAnimal(null)}
        onUpdated={onInvalidate}
        onTransfer={(a) => {
          setDetailAnimal(null);
          setTransferAnimalId(a.id);
        }}
        onChangeStatus={(a) => {
          setDetailAnimal(null);
          setStatusAnimal(a);
        }}
        onAddWeight={(a) => {
          setDetailAnimal(null);
          onOpenAnimalScreen(a);
        }}
        onOpenHealth={onOpenHealth}
        onListForSale={(a) => {
          setDetailAnimal(null);
          setSaleAnimal(a);
        }}
      />

      <CreateAnimalModal
        visible={createOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setCreateOpen(false)}
        onCreated={onInvalidate}
      />

      <BulkAddAnimalsModal
        visible={bulkOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setBulkOpen(false)}
        onCreated={onInvalidate}
      />

      <ChangeStatusModal
        visible={Boolean(statusAnimal)}
        animal={statusAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setStatusAnimal(null)}
        onUpdated={onInvalidate}
        onRequestSale={(a) => setSaleAnimal(a)}
        onRequestDisease={(a) => setDiseaseAnimal(a)}
      />

      <DiseaseModal
        visible={Boolean(diseaseAnimal)}
        presetAnimal={diseaseAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setDiseaseAnimal(null)}
        onSuccess={onInvalidate}
      />

      <SaleModal
        visible={Boolean(saleAnimal)}
        animal={saleAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onCancel={() => setSaleAnimal(null)}
        onSuccess={(sale: SaleResult) => {
          setSaleAnimal(null);
          onInvalidate();
          const tag =
            sale.animal.tagCode?.trim() ||
            sale.animal.publicId?.slice(0, 8) ||
            "—";
          const amount = Number(sale.transaction.amount);
          open("success", {
            title: t("cheptel.animals.sale.successTitle"),
            message: t("cheptel.animals.sale.successMessage", {
              tag,
              amount: amount.toLocaleString("fr-FR"),
              currency: sale.transaction.currency
            }),
            autoDismissMs: 3500
          });
        }}
      />

      <TransferModal
        visible={Boolean(transferAnimalId)}
        animals={animals}
        initialAnimalId={transferAnimalId}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setTransferAnimalId(null)}
        onTransferred={onInvalidate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    marginBottom: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    ...mobileTypography.body
  },
  batchesBlock: { marginBottom: mobileSpacing.lg },
  batchesTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    marginBottom: mobileSpacing.sm
  },
  batchCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  batchTitle: { fontWeight: "600", color: mobileColors.textPrimary },
  batchSub: { ...mobileTypography.meta, marginTop: 4 },
  fab: {
    position: "absolute",
    right: mobileSpacing.lg,
    bottom: mobileSpacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  fabText: { color: mobileColors.onAccent, fontSize: 28, fontWeight: "300", marginTop: -2 }
});
