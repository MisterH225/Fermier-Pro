import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  dueAt: string | null | undefined;
};

function progressColor(ratio: number): string {
  if (ratio >= 0.75) return "#E24B4A";
  if (ratio >= 0.5) return "#BA7517";
  return "#1D9E75";
}

export function CountdownBalance({ dueAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ratio = useMemo(() => {
    if (!dueAt) return 0;
    const due = new Date(dueAt).getTime();
    if (Number.isNaN(due)) return 0;
    const start = due - 4 * 86_400_000;
    const span = due - start;
    if (span <= 0) return 1;
    const elapsed = now - start;
    return Math.min(1, Math.max(0, elapsed / span));
  }, [dueAt, now]);

  if (!dueAt) return null;

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: progressColor(ratio) }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden",
    marginTop: mobileSpacing.xs
  },
  fill: {
    height: "100%",
    borderRadius: mobileRadius.pill
  }
});
