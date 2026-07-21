import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VetHealthTimelineItemDto } from "../../../lib/api/vet";
import {
  vetColors,
  vetRadius,
  vetStatus,
  vetType
} from "../../../theme/vetTheme";
import { mobileSpacing, mobileRadius, mobileFontSize } from "../../../theme/mobileTheme";
import { VetEmptyState } from "./VetEmptyState";

type Props = {
  items: VetHealthTimelineItemDto[] | null | undefined;
  locale: string;
  pageSize?: number;
};

function severityToken(sev: VetHealthTimelineItemDto["severity"]) {
  if (sev === "alert") {
    return vetStatus.alert;
  }
  if (sev === "watch") {
    return vetStatus.watch;
  }
  return vetStatus.ok;
}

export function HealthTimeline({ items, locale, pageSize = 5 }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(pageSize);
  const list = items ?? [];

  if (list.length === 0) {
    return (
      <VetEmptyState
        icon="time-outline"
        message={t("vet.farmDetail.timeline.empty")}
      />
    );
  }

  const shown = list.slice(0, visible);
  const hasMore = visible < list.length;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short"
    });

  return (
    <View style={styles.wrap}>
      {shown.map((ev, idx) => {
        const tok = severityToken(ev.severity);
        return (
          <View key={`${ev.date}-${ev.type}-${idx}`} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[styles.dot, { backgroundColor: tok.fg }]}
                accessibilityLabel={t(
                  `vet.farmDetail.timeline.severity.${ev.severity}`
                )}
              />
              {idx < shown.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.date}>{formatDate(ev.date)}</Text>
              <Text style={styles.label}>{ev.label}</Text>
              <View style={styles.badgeRow}>
                <Ionicons name={tok.icon} size={12} color={tok.fg} />
                <Text style={[styles.badge, { color: tok.fg }]}>
                  {t(`vet.farmDetail.timeline.type.${ev.type}`)}
                  {" · "}
                  {t(`vet.farmDetail.timeline.severity.${ev.severity}`)}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      {hasMore ? (
        <Pressable
          style={styles.moreBtn}
          onPress={() => setVisible((v) => Math.min(v + pageSize, list.length))}
          accessibilityRole="button"
        >
          <Text style={styles.moreTx}>
            {t("vet.farmDetail.timeline.seeMore")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: "row", gap: mobileSpacing.md, minHeight: 56 },
  rail: { width: 16, alignItems: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: mobileRadius.sm,
    marginTop: 4
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: vetColors.border,
    marginTop: 2
  },
  body: { flex: 1, paddingBottom: mobileSpacing.md, gap: 2 },
  date: { ...vetType.label },
  label: { ...vetType.body, fontWeight: "600" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  badge: { ...vetType.label, fontSize: mobileFontSize.xs },
  moreBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: vetRadius.pill,
    backgroundColor: vetColors.primaryLight
  },
  moreTx: {
    color: vetColors.primary,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  }
});
