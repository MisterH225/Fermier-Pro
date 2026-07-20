import { useSafeAreaInsets } from "react-native-safe-area-context";
import { producerQuickFabListClearance } from "../components/quickactions/producerQuickActions";
import { vetQuickFabListClearance } from "../components/quickactions/vetQuickActions";
import {
  BOTTOM_INSET_BASE,
  NAV_BAR_HEIGHT
} from "../constants/layout";
import { useBuyerBottomChromePad } from "../context/BuyerBottomChromeContext";
import { useMerchantBottomChromePad } from "../context/MerchantBottomChromeContext";
import { useProducerBottomChromePad } from "../context/ProducerBottomChromeContext";
import { useTechBottomChromePad } from "../context/TechBottomChromeContext";
import { useVetBottomChromePad } from "../context/VetBottomChromeContext";

function useActiveBottomChromePad(): number {
  const producer = useProducerBottomChromePad();
  const buyer = useBuyerBottomChromePad();
  const vet = useVetBottomChromePad();
  const tech = useTechBottomChromePad();
  const merchant = useMerchantBottomChromePad();
  return Math.max(producer, buyer, vet, tech, merchant);
}

/**
 * Réserve l’espace occupé par la navbar flottante + safe area (sans marge de confort).
 * À utiliser pour barres de saisie ou footers fixés en bas d’écran.
 */
export function useBottomChromePad(): number {
  const insets = useSafeAreaInsets();
  const chrome = useActiveBottomChromePad();
  if (chrome > 0) {
    return chrome;
  }
  return NAV_BAR_HEIGHT + insets.bottom;
}

/**
 * Padding bas standard pour ScrollView / FlatList (navbar + safe area + marge).
 * Côté producteur / vétérinaire, ajoute la réserve du FAB d’actions rapides
 * pour ne pas masquer la dernière ligne des listes des écrans racine.
 */
export function useBottomInset(): number {
  const producerPad = useProducerBottomChromePad();
  const vetPad = useVetBottomChromePad();
  const fabClearance =
    producerPad > 0
      ? producerQuickFabListClearance()
      : vetPad > 0
        ? vetQuickFabListClearance()
        : 0;
  return useBottomChromePad() + BOTTOM_INSET_BASE + fabClearance;
}
