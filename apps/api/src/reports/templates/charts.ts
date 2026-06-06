import { REPORT_COLORS } from "./palette";

export type ChartSegment = { label: string; value: number; color: string };

export function buildBarChartSvg(
  data: { label: string; value: number }[],
  width: number,
  height: number,
  barColor: string = REPORT_COLORS.primary
): string {
  if (data.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${REPORT_COLORS.lightBg}" rx="4"/></svg>`;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const pad = 8;
  const chartH = height - 24;
  const barW = (width - pad * 2) / data.length - 4;
  const bars = data
    .map((d, i) => {
      const h = Math.max(2, (d.value / max) * (chartH - pad));
      const x = pad + i * (barW + 4);
      const y = chartH - h + pad;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${barColor}" rx="2"/>`;
    })
    .join("");
  const labels = data
    .map((d, i) => {
      const x = pad + i * (barW + 4) + barW / 2;
      const short = d.label.length > 6 ? d.label.slice(5) : d.label;
      return `<text x="${x}" y="${height - 4}" font-size="6" text-anchor="middle" fill="${REPORT_COLORS.greyText}">${short}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${REPORT_COLORS.lightBg}" rx="4"/>${bars}${labels}</svg>`;
}

export function buildDonutSvg(
  segments: ChartSegment[],
  size: number,
  strokeWidth = 14
): string {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  let angle = -Math.PI / 2;
  const arcs = segments.map((seg) => {
    const slice = (seg.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${seg.color}" stroke-width="${strokeWidth}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${arcs.join("")}<circle cx="${cx}" cy="${cy}" r="${r - strokeWidth / 2 - 2}" fill="${REPORT_COLORS.white}"/></svg>`;
}

export function buildGaugeSvg(
  value: number,
  max: number,
  size: number,
  color = REPORT_COLORS.primary
): string {
  const pct = Math.min(1, Math.max(0, value / max));
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const start = -Math.PI * 0.75;
  const end = Math.PI * 0.75;
  const sweep = start + (end - start) * pct;
  const bgX1 = cx + r * Math.cos(start);
  const bgY1 = cy + r * Math.sin(start);
  const bgX2 = cx + r * Math.cos(end);
  const bgY2 = cy + r * Math.sin(end);
  const fgX = cx + r * Math.cos(sweep);
  const fgY = cy + r * Math.sin(sweep);
  const large = pct > 0.5 ? 1 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 1 1 ${bgX2} ${bgY2}" fill="none" stroke="${REPORT_COLORS.border}" stroke-width="10" stroke-linecap="round"/>
    <path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 ${large} 1 ${fgX} ${fgY}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/>
    <text x="${cx}" y="${cy + 4}" font-size="18" font-weight="bold" text-anchor="middle" fill="${REPORT_COLORS.accent}">${Math.round(value)}</text>
    <text x="${cx}" y="${cy + 16}" font-size="8" text-anchor="middle" fill="${REPORT_COLORS.greyText}">/ ${max}</text>
  </svg>`;
}

export function buildHorizontalBarSvg(
  value: number,
  max: number,
  width: number,
  height: number,
  color = REPORT_COLORS.primary
): string {
  const pct = Math.min(1, Math.max(0, value / Math.max(max, 1)));
  const fillW = Math.max(2, (width - 4) * pct);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="${REPORT_COLORS.lightBg}" rx="3"/>
    <rect x="2" y="2" width="${fillW}" height="${height - 4}" fill="${color}" rx="2"/>
  </svg>`;
}
