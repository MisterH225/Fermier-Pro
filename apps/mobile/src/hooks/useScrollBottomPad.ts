import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_INSET_BASE } from "../constants/layout";
import { useBottomInset } from "./useBottomInset";

type Options = {
  /** Marge supplémentaire sous le contenu. */
  extra?: number;
  /** Réserve pour une barre d’actions fixe (ex. CTA détail annonce). */
  stickyFooterHeight?: number;
  /** Inclure la barre de navigation flottante (producteur / acheteur / vet / tech). */
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
  const bottomInset = useBottomInset();
  const scrollPad = includeChrome ? bottomInset : insets.bottom + BOTTOM_INSET_BASE;

  return scrollPad + stickyFooterHeight + extra;
}

/** @deprecated Préférer `useBottomInset` ou `useBottomChromePad`. */
export { useBottomChromePad as useScrollBottomChromePad } from "./useBottomInset";
