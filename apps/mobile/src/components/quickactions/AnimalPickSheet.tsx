import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { AnimalListItem } from "../../lib/api";
import { fetchFarmAnimals } from "../../lib/api";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  title: string;
  onClose: () => void;
  onPick: (animal: AnimalListItem) => void;
};

/** Sélecteur d’animal actif (vente conclue / flux sans sujet pré-choisi). */
export function AnimalPickSheet({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  title,
  onClose,
  onPick
}: Props) {
  const { t } = useTranslation();
  const animalsQ = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId, "quickActionPick"],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: visible && Boolean(accessToken && farmId)
  });

  const animals = (animalsQ.data ?? []).filter((a) => a.status === "active");

  return (
    <BaseModal visible={visible} onClose={onClose} title={title}>
      <ModalSection flush>
        {animalsQ.isPending ? (
          <ActivityIndicator
            color={mobileColors.accent}
            style={{ marginVertical: mobileSpacing.lg }}
          />
        ) : animals.length === 0 ? (
          <Text style={styles.empty}>{t("quickActions.pickAnimalEmpty")}</Text>
        ) : (
          <View style={styles.list}>
            {animals.map((a) => {
              const tag = a.tagCode?.trim() || a.publicId.slice(0, 8);
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={tag}
                  testID={`animal-pick-${a.id}`}
                  onPress={() => {
                    onClose();
                    onPick(a);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.88 }
                  ]}
                >
                  <Text style={styles.tag}>{tag}</Text>
                  <Text style={styles.meta}>{a.breed?.name ?? "—"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  list: { gap: mobileSpacing.xs },
  row: {
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    minHeight: 52,
    justifyContent: "center"
  },
  tag: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    color: mobileColors.textPrimary
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    padding: mobileSpacing.md,
    textAlign: "center"
  }
});
