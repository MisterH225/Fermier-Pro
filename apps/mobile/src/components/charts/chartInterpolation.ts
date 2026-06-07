/** Point canvas pour courbes lissées (monotone / bezier). */
export type ChartPoint = { x: number; y: number };

/**
 * Courbe monotone cubique (type d3 curveMonotoneX) — segments droits interdits entre points.
 */
export function monotoneCurvePath(points: ChartPoint[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (n === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  const tangents = monotoneTangents(points);
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const t0 = tangents[i]!;
    const t1 = tangents[i + 1]!;
    const cp1x = p0.x + t0.x / 3;
    const cp1y = p0.y + t0.y / 3;
    const cp2x = p1.x - t1.x / 3;
    const cp2y = p1.y - t1.y / 3;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p1.x} ${p1.y}`;
  }
  return d;
}

function monotoneTangents(points: ChartPoint[]): ChartPoint[] {
  const n = points.length;
  const tangents: ChartPoint[] = new Array(n);
  const deltas: number[] = new Array(n - 1);
  const slopes: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x;
    const dy = points[i + 1]!.y - points[i]!.y;
    deltas[i] = dx;
    slopes[i] = dx !== 0 ? dy / dx : 0;
  }

  tangents[0] = { x: deltas[0]!, y: slopes[0]! * deltas[0]! };
  tangents[n - 1] = {
    x: deltas[n - 2]!,
    y: slopes[n - 2]! * deltas[n - 2]!
  };

  for (let i = 0; i < n - 2; i++) {
    const s0 = slopes[i]!;
    const s1 = slopes[i + 1]!;
    const d = deltas[i + 1]!;
    if (s0 * s1 <= 0) {
      tangents[i + 1] = { x: 0, y: 0 };
    } else {
      const m = (s0 + s1) / 2;
      tangents[i + 1] = { x: d, y: m * d };
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const t = tangents[i]!;
    const s = slopes[i]!;
    if (Math.abs(s) < 1e-6) {
      tangents[i] = { x: 0, y: 0 };
      continue;
    }
    const r = Math.hypot(t.x, t.y) / Math.hypot(deltas[i]!, s * deltas[i]!);
    if (r > 3) {
      const scale = 3 / r;
      tangents[i] = { x: t.x * scale, y: t.y * scale };
    }
  }

  for (let i = n - 1; i > 0; i--) {
    const t = tangents[i]!;
    const s = slopes[i - 1]!;
    if (Math.abs(s) < 1e-6) {
      tangents[i] = { x: 0, y: 0 };
      continue;
    }
    const r = Math.hypot(t.x, t.y) / Math.hypot(deltas[i - 1]!, s * deltas[i - 1]!);
    if (r > 3) {
      const scale = 3 / r;
      tangents[i] = { x: t.x * scale, y: t.y * scale };
    }
  }

  return tangents;
}

/** Longueur approximative du path SVG (pour animation de tracé). */
export function approximatePathLength(points: ChartPoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i]!.x - points[i - 1]!.x,
      points[i]!.y - points[i - 1]!.y
    );
  }
  return Math.max(len * 1.35, 1);
}
