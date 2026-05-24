import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AnimalListItem, BatchListItem, FarmHealthEntityType } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  livestockMode: "individual" | "batch" | "hybrid";
  animals: AnimalListItem[];
  batches: BatchListItem[];
  subjectType: FarmHealthEntityType;
  subjectId: string;
  onSelect: (type: FarmHealthEntityType, id: string) => void;
  labels: {
    title: string;
    modeHint: string;
    pickAnimal: string;
    pickBatch: string;
  };
};

export function HealthSubjectPicker({
  livestockMode,
  animals,
  batches,
  subjectType,
  subjectId,
  onSelect,
  labels
}: Props) {
  const showAnimal = livestockMode === "individual" || livestockMode === "hybrid";
  const showBatch = livestockMode === "batch" || livestockMode === "hybrid";

  const animalLabel = (a: AnimalListItem) =>
    a.tagCode?.trim() || a.publicId.slice(0, 8);
  const batchLabel = (b: BatchListItem) => b.name || b.id.slice(0, 8);

  return (
    <>
      <Text style={styles.h1}>{labels.title}</Text>
      <Text style={styles.hint}>{labels.modeHint}</Text>
      {showAnimal ? (
        <View style={styles.block}>
          <Text style={styles.lab}>{labels.pickAnimal}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {animals.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chip,
                  subjectType === "animal" && subjectId === a.id && styles.chipOn
                ]}
                onPress={() => onSelect("animal", a.id)}
              >
                <Text style={styles.chipTx}>{animalLabel(a)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {showBatch ? (
        <View style={styles.block}>
          <Text style={styles.lab}>{labels.pickBatch}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {batches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.chip,
                  subjectType === "group" && subjectId === b.id && styles.chipOn
                ]}
                onPress={() => onSelect("group", b.id)}
              >
                <Text style={styles.chipTx}>{batchLabel(b)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  h1: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  block: { marginBottom: mobileSpacing.sm },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    marginRight: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}18`
  },
  chipTx: { fontSize: 13, color: mobileColors.textPrimary }
});
