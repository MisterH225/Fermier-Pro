import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  barnCodeForIndex,
  barnLabelForIndex,
  buildPenAssignmentMap,
  penNameForBarn,
  type PenAssignment,
  type PenAssignmentKind
} from "../../lib/onboardingPenLayout";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const KIND_STYLE: Record<
  PenAssignmentKind,
  { bg: string; border: string; dot: string }
> = {
  females: { bg: "#FDF2F8", border: "#F9A8D4", dot: "#DB2777" },
  male: { bg: "#FFF7ED", border: "#FDBA74", dot: "#EA580C" },
  starter: { bg: "#EFF6FF", border: "#93C5FD", dot: "#2563EB" },
  fattening: { bg: "#F0FDF4", border: "#86EFAC", dot: "#16A34A" },
  mixed: { bg: "#FFFBEB", border: "#FCD34D", dot: "#D97706" }
};

type Props = {
  buildingsCount: number | null;
  pensPerBuilding: number | null;
  maxPigsPerPen: number | null;
  femaleCount?: number;
  maleCount?: number;
  starterCount?: number;
  fatteningCount?: number;
};

function parseCounts(...values: (number | undefined)[]) {
  return values.map((v) => (v != null && v >= 0 ? v : 0));
}

export function OnboardingPenLayoutPreview({
  buildingsCount,
  pensPerBuilding,
  maxPigsPerPen,
  femaleCount = 0,
  maleCount = 0,
  starterCount = 0,
  fatteningCount = 0
}: Props) {
  const { t } = useTranslation();

  const layout = useMemo(() => {
    if (
      buildingsCount == null ||
      pensPerBuilding == null ||
      maxPigsPerPen == null ||
      buildingsCount < 1 ||
      pensPerBuilding < 1 ||
      maxPigsPerPen < 1
    ) {
      return null;
    }
    const [f, m, s, fat] = parseCounts(
      femaleCount,
      maleCount,
      starterCount,
      fatteningCount
    );
    const assignments = buildPenAssignmentMap({
      buildingsCount,
      pensPerBuilding,
      capacity: maxPigsPerPen,
      femaleCount: f,
      maleCount: m,
      starterCount: s,
      fatteningCount: fat
    });
    const columns = Array.from({ length: buildingsCount }, (_, barnIndex) => {
      const code = barnCodeForIndex(barnIndex);
      const pens = Array.from({ length: pensPerBuilding }, (_, penIndex) => {
        const key = `${barnIndex}-${penIndex}`;
        return {
          name: penNameForBarn(code, penIndex),
          assignment: assignments.get(key) ?? null
        };
      });
      return {
        barnIndex,
        code,
        barnName: barnLabelForIndex(barnIndex),
        pens
      };
    });
    return { columns, capacity: maxPigsPerPen };
  }, [
    buildingsCount,
    pensPerBuilding,
    maxPigsPerPen,
    femaleCount,
    maleCount,
    starterCount,
    fatteningCount
  ]);

  const assignmentLabel = (a: PenAssignment | null) => {
    if (!a) {
      return null;
    }
    const n = a.headcount;
    switch (a.kind) {
      case "females":
        return t("onboarding.step4.assignFemales", { n });
      case "male":
        return t("onboarding.step4.assignMale");
      case "starter":
        return t("onboarding.step4.assignStarter", { n });
      case "fattening":
        return t("onboarding.step4.assignFattening", { n });
      case "mixed":
        return t("onboarding.step4.assignMixed", { n });
      default:
        return null;
    }
  };

  const columnHeader = (barnIndex: number, barnName: string) => {
    if (layout && layout.columns.length === 2) {
      return barnIndex === 0
        ? t("onboarding.step4.columnLeft")
        : t("onboarding.step4.columnRight");
    }
    return barnName;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.previewTitle}>{t("onboarding.step4.layoutPreview")}</Text>
      <Text style={styles.previewSub}>{t("onboarding.step4.topToBottom")}</Text>

      {!layout ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTx}>
            {t("onboarding.step4.layoutPreviewEmpty")}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal={layout.columns.length > 2}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.columnsRow,
            layout.columns.length > 2 && styles.columnsRowScroll
          ]}
        >
          {layout.columns.map((col) => (
            <View
              key={col.code}
              style={[
                styles.column,
                layout.columns.length === 2 && styles.columnHalf,
                layout.columns.length > 2 && styles.columnFixed
              ]}
            >
              <Text style={styles.columnTitle}>
                {columnHeader(col.barnIndex, col.barnName)}
              </Text>
              <Text style={styles.columnSub}>{col.barnName}</Text>
              <View style={styles.penStack}>
                {col.pens.map((pen) => {
                  const kind = pen.assignment?.kind;
                  const palette = kind ? KIND_STYLE[kind] : null;
                  const assignTx = assignmentLabel(pen.assignment);
                  return (
                    <View
                      key={pen.name}
                      style={[
                        styles.penCell,
                        palette && {
                          backgroundColor: palette.bg,
                          borderColor: palette.border
                        }
                      ]}
                    >
                      <View style={styles.penCellTop}>
                        <Text style={styles.penName}>{pen.name}</Text>
                        {palette ? (
                          <View
                            style={[styles.penDot, { backgroundColor: palette.dot }]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.penCap}>
                        {t("onboarding.step4.penCapacity", {
                          n: layout.capacity
                        })}
                      </Text>
                      {assignTx ? (
                        <Text style={styles.penAssign} numberOfLines={2}>
                          {assignTx}
                        </Text>
                      ) : (
                        <Text style={styles.penEmpty}>
                          {t("onboarding.step4.penVacant")}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.legend}>
        <LegendDot color={KIND_STYLE.females.dot} label={t("onboarding.step4.legendFemales")} />
        <LegendDot color={KIND_STYLE.male.dot} label={t("onboarding.step4.legendMale")} />
        <LegendDot color={KIND_STYLE.starter.dot} label={t("onboarding.step4.legendStarter")} />
        <LegendDot color={KIND_STYLE.fattening.dot} label={t("onboarding.step4.legendFattening")} />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendTx}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  previewTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  previewSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  placeholder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.lg,
    alignItems: "center"
  },
  placeholderTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  columnsRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.xs
  },
  columnsRowScroll: {
    paddingRight: mobileSpacing.md
  },
  column: {
    minWidth: 0
  },
  columnHalf: {
    flex: 1
  },
  columnFixed: {
    width: 148
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  columnSub: {
    fontSize: 11,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs
  },
  penStack: {
    gap: 6
  },
  penCell: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: mobileColors.background
  },
  penCellTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  penName: {
    fontSize: 14,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  penDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  penCap: {
    fontSize: 10,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  penAssign: {
    fontSize: 10,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    marginTop: 4
  },
  penEmpty: {
    fontSize: 10,
    color: mobileColors.textSecondary,
    marginTop: 4,
    fontStyle: "italic"
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: mobileSpacing.xs
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendTx: {
    fontSize: 10,
    color: mobileColors.textSecondary
  }
});
