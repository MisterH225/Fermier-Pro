import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatXof,
  stageLabelFr,
  statusLabelFr
} from "../../lib/feedCompositionFormat";
import { useRolePalette } from "../../hooks/useRolePalette";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  composition: {
    id: string;
    stage: string;
    status: string;
    farmId: string;
    totalCostXof: number;
  };
  farmName?: string | null;
};

/**
 * Bandeau ancré en tête d’un chat `feed_composition` —
 * ouvre le détail (ration complète + actions véto).
 */
export function CompositionContextBanner({ composition, farmName }: Props) {
  const palette = useRolePalette();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}
      testID="composition-context-banner"
      onPress={() =>
        navigation.navigate("FeedCompositionDetail", {
          farmId: composition.farmId,
          farmName: farmName?.trim() || "—",
          compositionId: composition.id
        })
      }
    >
      <View style={styles.body}>
        <Text style={styles.label}>Composition à valider</Text>
        <Text style={styles.title} numberOfLines={1}>
          {stageLabelFr(composition.stage)}
        </Text>
        <Text style={[styles.meta, { color: palette.primary }]} numberOfLines={1}>
          {statusLabelFr(composition.status)} · {formatXof(composition.totalCostXof)}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginHorizontal: mobileSpacing.md,
    marginTop: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs,
    padding: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  body: { flex: 1, minWidth: 0 },
  label: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  meta: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    fontWeight: "700"
  },
  chevron: {
    fontSize: 22,
    color: mobileColors.textSecondary,
    paddingHorizontal: 4
  }
});
