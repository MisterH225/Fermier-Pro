import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== mo ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m: mo, d };
}

function todayParts(): { y: number; m: number; d: number } {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
};

/** Sélecteur jour par jour (même logique que les rapports : ◀ période ▶). */
export function TaskDueDateField({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const parsed = value.trim() ? parseIsoDate(value) : null;
  const parts = parsed ?? todayParts();
  const hasDate = Boolean(parsed);

  const shift = (delta: number) => {
    const base = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
    base.setUTCDate(base.getUTCDate() + delta);
    onChange(
      toIsoDate(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate()
      )
    );
  };

  const shortLabel = hasDate
    ? `${pad2(parts.d)}/${pad2(parts.m)}/${parts.y}`
    : t("tasksScreen.dueDateNone");
  const longLabel = hasDate
    ? new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).toLocaleDateString(
        locale,
        { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      )
    : t("tasksScreen.dueDateHint");

  return (
    <View style={styles.root}>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => shift(-1)}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={t("tasksScreen.dueDatePrev")}
        >
          <Text style={styles.navBtnText}>◀</Text>
        </Pressable>
        <Pressable
          style={styles.navCenter}
          onPress={() => {
            if (!hasDate) {
              onChange(toIsoDate(parts.y, parts.m, parts.d));
            }
          }}
          accessibilityRole="button"
        >
          <Text style={styles.navMain}>{shortLabel}</Text>
          <Text style={styles.navSub}>{longLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => shift(1)}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={t("tasksScreen.dueDateNext")}
        >
          <Text style={styles.navBtnText}>▶</Text>
        </Pressable>
      </View>
      {hasDate ? (
        <Pressable onPress={() => onChange("")} style={styles.clearBtn}>
          <Text style={styles.clearTx}>{t("tasksScreen.dueDateClear")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: mobileSpacing.xs },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  navBtn: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  navBtnText: {
    fontSize: 18,
    color: mobileColors.accent,
    fontWeight: "800"
  },
  navCenter: { flex: 1, alignItems: "center" },
  navMain: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  navSub: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  clearBtn: { alignSelf: "flex-start", paddingVertical: mobileSpacing.xs },
  clearTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});
