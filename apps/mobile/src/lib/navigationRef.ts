import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "../types/navigation";

/** Référence globale au conteneur de navigation racine. */
export const rootNavigationRef =
  createNavigationContainerRef<RootStackParamList>();
