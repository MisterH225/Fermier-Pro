import type { Ionicons } from "@expo/vector-icons";
import type { ExtendedNavMenuId } from "./types";

export const EXTENDED_MENU_ICONS: Record<
  ExtendedNavMenuId,
  keyof typeof Ionicons.glyphMap
> = {
  nutrition: "leaf-outline",
  collaboration: "people-outline",
  market: "cart-outline",
  gestation: "egg-outline",
  tasks: "checkbox-outline",
  reports: "bar-chart-outline",
  messages: "chatbubbles-outline",
  prescriptions: "medkit-outline",
  settings: "settings-outline"
};
