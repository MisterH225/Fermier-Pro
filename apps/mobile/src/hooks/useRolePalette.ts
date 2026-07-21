import { useMemo } from "react";
import {
  paletteForProfileType,
  type RolePalette
} from "../components/common/rolePalette";
import { useSession } from "../context/SessionContext";

/** Palette du profil actif (producteur par défaut si inconnu). */
export function useRolePalette(): RolePalette {
  const { authMe } = useSession();
  const type = authMe?.activeProfile?.type;
  return useMemo(() => paletteForProfileType(type), [type]);
}
