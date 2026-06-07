import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

const skelBg = mobileColors.surfaceMuted;

/** Ligne type liste (EventList, transactions). */
export function ListItemSkeleton() {
  return (
    <View style={styles.listCard}>
      <View style={styles.listRow}>
        <View style={styles.circle} />
        <View style={styles.listTextCol}>
          <View style={styles.lineLg} />
          <View style={styles.lineSm} />
        </View>
        <View style={styles.listRightCol}>
          <View style={[styles.lineSm, { width: 72 }]} />
          <View style={[styles.lineSm, { width: 48 }]} />
        </View>
      </View>
    </View>
  );
}

/** Contenu compact pour cartes dashboard. */
export function CardContentSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.cardContent}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={[styles.lineLg, i > 0 && styles.lineShorter]} />
      ))}
    </View>
  );
}

/** Grille 2×2 de cartes KPI. */
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.kpiGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.kpiCell}>
          <View style={[styles.lineSm, { width: "55%" }]} />
          <View style={[styles.lineLg, { marginTop: mobileSpacing.sm }]} />
          <View style={[styles.lineSm, { width: "40%", marginTop: mobileSpacing.xs }]} />
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({
  count = 4,
  style
}: {
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: skelBg
  },
  listTextCol: { flex: 1, gap: 8 },
  listRightCol: { alignItems: "flex-end", gap: 6 },
  lineLg: {
    height: 14,
    borderRadius: 6,
    backgroundColor: skelBg,
    width: "100%"
  },
  lineShorter: { width: "78%" },
  lineSm: {
    height: 10,
    borderRadius: 5,
    backgroundColor: skelBg,
    width: "70%"
  },
  cardContent: { gap: mobileSpacing.sm, paddingVertical: mobileSpacing.xs },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  kpiCell: {
    width: "48%",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  }
});
