import { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View
} from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  min: number;
  max: number;
  step?: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  formatValue?: (n: number) => string;
  trackColor: string;
  fillColor: string;
  thumbColor: string;
  labelColor: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function snap(n: number, step: number) {
  return Math.round(n / step) * step;
}

/**
 * Slider double-pouce sans dépendance externe (fourchettes prix / plages).
 */
export function DualRangeSlider({
  min,
  max,
  step = 50,
  low,
  high,
  onChange,
  formatValue = (n) => String(n),
  trackColor,
  fillColor,
  thumbColor,
  labelColor
}: Props) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const lowRef = useRef(low);
  const highRef = useRef(high);
  const startLow = useRef(low);
  const startHigh = useRef(high);
  lowRef.current = low;
  highRef.current = high;

  const span = Math.max(1, max - min);

  const toX = useCallback(
    (value: number) => ((value - min) / span) * widthRef.current,
    [min, span]
  );

  const fromX = useCallback(
    (x: number) => {
      if (widthRef.current <= 0) return min;
      const raw = min + (clamp(x, 0, widthRef.current) / widthRef.current) * span;
      return clamp(snap(raw, step), min, max);
    },
    [min, max, span, step]
  );

  const lowPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startLow.current = lowRef.current;
        },
        onPanResponderMove: (_, g) => {
          const next = fromX(toX(startLow.current) + g.dx);
          onChange(Math.min(next, highRef.current - step), highRef.current);
        }
      }),
    [fromX, onChange, step, toX]
  );

  const highPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startHigh.current = highRef.current;
        },
        onPanResponderMove: (_, g) => {
          const next = fromX(toX(startHigh.current) + g.dx);
          onChange(lowRef.current, Math.max(next, lowRef.current + step));
        }
      }),
    [fromX, onChange, step, toX]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const lowX = width > 0 ? toX(low) : 0;
  const highX = width > 0 ? toX(high) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: labelColor }]}>
          {formatValue(low)}
        </Text>
        <Text style={[styles.label, { color: labelColor }]}>
          {formatValue(high)}
        </Text>
      </View>
      <View style={styles.trackWrap} onLayout={onLayout}>
        <View style={[styles.track, { backgroundColor: trackColor }]} />
        {width > 0 ? (
          <View
            style={[
              styles.fill,
              {
                backgroundColor: fillColor,
                left: lowX,
                width: Math.max(0, highX - lowX)
              }
            ]}
          />
        ) : null}
        {width > 0 ? (
          <>
            <View
              style={[styles.thumb, { left: lowX - 12, backgroundColor: thumbColor }]}
              {...lowPan.panHandlers}
            />
            <View
              style={[styles.thumb, { left: highX - 12, backgroundColor: thumbColor }]}
              {...highPan.panHandlers}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  label: { ...mobileTypography.meta, fontWeight: "700" },
  trackWrap: {
    height: 28,
    justifyContent: "center"
  },
  track: {
    height: 6,
    borderRadius: 999
  },
  fill: {
    position: "absolute",
    height: 6,
    borderRadius: 999
  },
  thumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    top: 2,
    elevation: 2,
    shadowColor: mobileColors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  }
});
