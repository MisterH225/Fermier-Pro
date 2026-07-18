import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { DiseaseModal } from "../../shared/DiseaseModal";
import { useModal } from "../../modals/useModal";
import {
  SellChooserSheet,
  type SellChooserChoice
} from "../../quickactions/SellChooserSheet";
import type { AnimalListItem } from "../../../lib/api";
import type { CheptelAnimalActions } from "../../../hooks/useCheptelAnimalActions";
import { usePostSaveInsight } from "../../../hooks/usePostSaveInsight";
import type { RootStackParamList } from "../../../types/navigation";
import { AddWeightModal } from "../weight/AddWeightModal";
import { ChangeStatusModal } from "./ChangeStatusModal";
import { SaleModal, type SaleResult } from "./SaleModal";
import { TransferModal } from "./TransferModal";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  animals: AnimalListItem[];
  actions: CheptelAnimalActions;
  onInvalidate: () => void;
};

export function CheptelAnimalActionModals({
  farmId,
  accessToken,
  activeProfileId,
  animals,
  actions,
  onInvalidate
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const insights = usePostSaveInsight();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const onSaleSuccess = (sale: SaleResult) => {
    actions.closeSale();
    onInvalidate();
    if (!sale.animal?.id || !sale.transaction) {
      return;
    }
    const tag =
      sale.animal.tagCode?.trim() ||
      sale.animal.publicId?.slice(0, 8) ||
      "—";
    const amount = Number(sale.transaction.amount);
    const baseMessage = t("cheptel.animals.sale.successMessage", {
      tag,
      amount: amount.toLocaleString("fr-FR"),
      currency: sale.transaction.currency
    });
    void (async () => {
      const detail = sale.exitId
        ? await insights.afterSale(
            { accessToken, farmId, activeProfileId },
            sale.exitId
          )
        : undefined;
      open("success", {
        title: t("cheptel.animals.sale.successTitle"),
        message: baseMessage,
        detail,
        autoDismissMs: detail ? 4500 : 3500
      });
    })();
  };

  const onSellChoice = (choice: SellChooserChoice) => {
    const animal = actions.sellChooserAnimal;
    actions.closeSellChooser();
    if (!animal) {
      return;
    }
    if (choice === "marketplace") {
      navigation.navigate("CreateMarketplaceListing", { farmId });
      return;
    }
    actions.openSale(animal);
  };

  return (
    <>
      <ChangeStatusModal
        visible={Boolean(actions.statusAnimal)}
        animal={actions.statusAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        presetStatus={actions.statusPreset}
        onClose={actions.closeStatus}
        onUpdated={() => {
          actions.closeStatus();
          onInvalidate();
        }}
        onRequestSale={actions.openSale}
        onRequestDisease={actions.openDisease}
      />

      <SellChooserSheet
        visible={Boolean(actions.sellChooserAnimal)}
        onClose={actions.closeSellChooser}
        onChoose={onSellChoice}
      />

      <DiseaseModal
        visible={Boolean(actions.diseaseAnimal)}
        presetAnimal={actions.diseaseAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={actions.closeDisease}
        onSuccess={onInvalidate}
      />

      <SaleModal
        visible={Boolean(actions.saleAnimal)}
        animal={actions.saleAnimal}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onCancel={actions.closeSale}
        onSuccess={onSaleSuccess}
      />

      <TransferModal
        visible={Boolean(actions.transferAnimal)}
        initialAnimalId={actions.transferAnimal?.id}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        animals={animals}
        onClose={actions.closeTransfer}
        onTransferred={() => {
          actions.closeTransfer();
          onInvalidate();
        }}
      />

      <AddWeightModal
        visible={Boolean(actions.weightAnimal)}
        preselectedAnimalId={actions.weightAnimal?.id}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={actions.closeWeight}
        onSaved={() => {
          actions.closeWeight();
          onInvalidate();
        }}
      />
    </>
  );
}
