import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { EmptyStateCard } from "../../common/EmptyStateCard";
import { vetPalette } from "../../common/rolePalette";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  icon: IconName;
  message: string;
};

/** État vide soigné — délègue à EmptyStateCard + palette véto. */
export function VetEmptyState({ icon, message }: Props) {
  return (
    <EmptyStateCard icon={icon} title={message} palette={vetPalette} />
  );
}
