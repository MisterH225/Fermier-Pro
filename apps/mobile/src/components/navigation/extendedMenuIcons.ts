import type { Ionicons } from "@expo/vector-icons";
import type { ExtendedNavMenuId } from "./types";

export const EXTENDED_MENU_ICONS: Record<
  ExtendedNavMenuId,
  keyof typeof Ionicons.glyphMap
> = {
  team: "people-outline",
  nutrition: "leaf-outline",
  collaboration: "people-outline",
  communityFeed: "at-outline",
  market: "cart-outline",
  gestation: "egg-outline",
  tasks: "checkbox-outline",
  reports: "bar-chart-outline",
  messages: "chatbubbles-outline",
  prescriptions: "medkit-outline",
  settings: "settings-outline",
  vaccinations: "medkit-outline",
  weighings: "scale-outline",
  feedStock: "nutrition-outline",
  favorites: "heart-outline",
  priceAlerts: "notifications-outline",
  reviews: "star-outline",
  preferences: "options-outline"
};
