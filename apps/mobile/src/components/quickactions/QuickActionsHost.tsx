import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../context/SessionContext";
import type { AnimalListItem } from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import { AddWeightModal } from "../cheptel/weight/AddWeightModal";
import { SaleModal, type SaleResult } from "../cheptel/animals/SaleModal";
import { useModal } from "../modals/useModal";
import { usePostSaveInsight } from "../../hooks/usePostSaveInsight";
import { AnimalPickSheet } from "./AnimalPickSheet";
import { QuickActionsFab } from "./QuickActionsFab";
import { QuickActionsSheet } from "./QuickActionsSheet";
import {
  readLastWeighSubject,
  writeLastWeighSubject
} from "./lastWeighSubject";
import {
  isProducerQuickActionRootRoute,
  type ProducerQuickActionId
} from "./producerQuickActions";
import {
  SellChooserSheet,
  type SellChooserChoice
} from "./SellChooserSheet";

type Props = {
  visible: boolean;
  focusedRouteName: string | undefined;
  farmContext: { farmId: string; farmName: string } | null;
};

/**
 * FAB + feuilles d’actions producteur (écrans racine uniquement).
 */
export function QuickActionsHost({
  visible,
  focusedRouteName,
  farmContext
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();
  const { open } = useModal();
  const insights = usePostSaveInsight();
  const qc = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [preselectedAnimalId, setPreselectedAnimalId] = useState<string | null>(
    null
  );
  const [salePickOpen, setSalePickOpen] = useState(false);
  const [saleAnimal, setSaleAnimal] = useState<AnimalListItem | null>(null);

  const showFab =
    visible && isProducerQuickActionRootRoute(focusedRouteName);

  useEffect(() => {
    if (!showFab) {
      setSheetOpen(false);
    }
  }, [showFab]);

  const openWeigh = useCallback(async () => {
    if (!farmContext || !accessToken) {
      return;
    }
    const last = await readLastWeighSubject(farmContext.farmId);
    setPreselectedAnimalId(last?.animalId ?? null);
    setWeightOpen(true);
  }, [farmContext, accessToken]);

  const onAction = useCallback(
    (id: ProducerQuickActionId) => {
      if (!farmContext) {
        navigation.navigate("FarmList");
        return;
      }
      const { farmId, farmName } = farmContext;

      switch (id) {
        case "weigh":
          void openWeigh();
          return;
        case "mortality":
          navigation.navigate("FarmHealth", {
            farmId,
            farmName,
            initialTab: "mortality",
            openFormKind: "mortality"
          });
          return;
        case "farrowing":
          navigation.navigate("FarmGestation", {
            farmId,
            farmName,
            initialTab: "birth",
            autoOpenLitter: true
          });
          return;
        case "sell":
          setSellOpen(true);
          return;
        case "expense":
          navigation.navigate("FarmFinance", {
            farmId,
            farmName,
            initialTab: "depenses",
            openTransaction: true
          });
          return;
        case "feedIn":
          navigation.navigate("FarmFeedStock", {
            farmId,
            farmName,
            autoOpenEntry: true
          });
          return;
        case "stockCheck":
          navigation.navigate("FarmFeedStock", {
            farmId,
            farmName,
            autoOpenControl: true
          });
          return;
        default:
          return;
      }
    },
    [farmContext, navigation, openWeigh]
  );

  const onSellChoice = useCallback(
    (choice: SellChooserChoice) => {
      if (!farmContext) {
        navigation.navigate("FarmList");
        return;
      }
      if (choice === "marketplace") {
        navigation.navigate("CreateMarketplaceListing", {
          farmId: farmContext.farmId
        });
        return;
      }
      setSalePickOpen(true);
    },
    [farmContext, navigation]
  );

  const onSaleSuccess = (sale: SaleResult) => {
    setSaleAnimal(null);
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmContext?.farmId] });
    if (!sale.animal?.id || !sale.transaction || !farmContext) {
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
      const detail =
        sale.exitId && accessToken
          ? await insights.afterSale(
              {
                accessToken,
                farmId: farmContext.farmId,
                activeProfileId
              },
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

  if (!showFab || !accessToken) {
    return null;
  }

  return (
    <>
      <QuickActionsFab onPress={() => setSheetOpen(true)} />
      <QuickActionsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={onAction}
      />
      <SellChooserSheet
        visible={sellOpen}
        onClose={() => setSellOpen(false)}
        onChoose={onSellChoice}
      />
      {farmContext ? (
        <>
          <AddWeightModal
            visible={weightOpen}
            farmId={farmContext.farmId}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            preselectedAnimalId={preselectedAnimalId}
            onClose={() => setWeightOpen(false)}
            onSaved={(animalId) => {
              setWeightOpen(false);
              if (animalId) {
                void writeLastWeighSubject(farmContext.farmId, { animalId });
              }
              void qc.invalidateQueries({
                queryKey: ["farmAnimals", farmContext.farmId]
              });
            }}
          />
          <AnimalPickSheet
            visible={salePickOpen}
            farmId={farmContext.farmId}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            title={t("quickActions.sell.pickAnimalTitle")}
            onClose={() => setSalePickOpen(false)}
            onPick={(animal) => setSaleAnimal(animal)}
          />
          <SaleModal
            visible={Boolean(saleAnimal)}
            animal={saleAnimal}
            farmId={farmContext.farmId}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
            onCancel={() => setSaleAnimal(null)}
            onSuccess={onSaleSuccess}
          />
        </>
      ) : null}
    </>
  );
}
