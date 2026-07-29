import { useMemo } from "react";
import {
  orderPaletteForProfileType,
  type OrderPalette
} from "../components/orders/orderTheme";
import { useSession } from "../context/SessionContext";

/** Palette commande du profil actif (producteur / ordersPalette par défaut). */
export function useOrderPalette(): OrderPalette {
  const { authMe } = useSession();
  const type = authMe?.activeProfile?.type;
  return useMemo(() => orderPaletteForProfileType(type), [type]);
}
