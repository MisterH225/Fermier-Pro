import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBuyerBottomChromePad } from "../context/BuyerBottomChromeContext";
import { useProducerBottomChromePad } from "../context/ProducerBottomChromeContext";
import { mobileSpacing } from "../theme/mobileTheme";

type Options = {
  /** Marge supplémentaire sous le contenu. */
  extra?: number;
  /** Réserve pour une barre d’actions fixe (ex. CTA détail annonce). */
  stickyFooterHeight?: number;
  /** Inclure la barre de navigation flottante (producteur / acheteur). */
  includeChrome?: boolean;
};

/**
 * Padding bas pour ScrollView / FlatList afin que le contenu ne passe pas
 * sous la barre de navigation flottante ni sous une barre d’actions fixe.
 */
export function useScrollBottomPad(options: Options = {}): number {
  const {
    extra = 0,
    stickyFooterHeight = 0,
    includeChrome = true
  } = options;
  const insets = useSafeAreaInsets();
  const producerPad = useProducerBottomChromePad();
  const buyerPad = useBuyerBottomChromePad();
  const chromePad = includeChrome ? Math.max(producerPad, buyerPad) : 0;

  return (
    Math.max(insets.bottom, mobileSpacing.md) +
    chromePad +
    mobileSpacing.xl +
    stickyFooterHeight +
    extra
  );
}
