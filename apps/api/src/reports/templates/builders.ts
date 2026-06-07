import type { PdfContent, PdfTableCell } from "./pdf-types";
import { REPORT_COLORS, REPORT_TYPO } from "./palette";

export function buildSectionHeader(title: string, color: string = REPORT_COLORS.primary): PdfContent {
  return {
    columns: [
      {
        width: 4,
        canvas: [{ type: "rect", x: 0, y: 0, w: 4, h: 16, color }]
      },
      {
        width: "*",
        text: title.toUpperCase(),
        style: "sectionHeader",
        margin: [8, 0, 0, 6]
      }
    ],
    margin: [0, 0, 0, 8]
  };
}

export function buildKpiCard(
  label: string,
  value: string,
  unit: string,
  borderColor: string = REPORT_COLORS.primary
): PdfContent {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              {
                canvas: [
                  { type: "rect", x: 0, y: 0, w: 160, h: 3, color: borderColor }
                ],
                margin: [0, 0, 0, 4]
              },
              { text: label, style: "kpiLabel" },
              {
                text: `${value}${unit ? ` ${unit}` : ""}`,
                style: "kpiValue",
                color: borderColor
              }
            ],
            fillColor: REPORT_COLORS.white,
            margin: [8, 8, 8, 8]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => REPORT_COLORS.border,
      vLineColor: () => REPORT_COLORS.border
    }
  };
}

export function buildProgressBar(
  value: number,
  max: number,
  color: string,
  label: string
): PdfContent {
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  const filled = Math.round(pct);
  return {
    table: {
      widths: ["*", 120],
      body: [
        [
          { text: label, style: "small" },
          {
            table: {
              widths: [filled, 100 - filled],
              body: [
                [
                  { text: "", fillColor: color, margin: [0, 4, 0, 4] },
                  { text: "", fillColor: REPORT_COLORS.lightBg, margin: [0, 4, 0, 4] }
                ]
              ]
            },
            layout: "noBorders"
          }
        ]
      ]
    },
    layout: "noBorders",
    margin: [0, 2, 0, 2]
  };
}

export function buildDataTable(
  headers: string[],
  rows: string[][],
  headerColor = REPORT_COLORS.primary
): PdfContent {
  const headerRow: PdfTableCell[] = headers.map((h) => ({
    text: h,
    style: "tableHeader",
    fillColor: headerColor,
    color: REPORT_COLORS.white
  }));
  const bodyRows: PdfTableCell[][] = rows.map((row) =>
    row.map((cell) => ({ text: cell, style: "small" }))
  );
  return {
    table: {
      headerRows: 1,
      widths: headers.map(() => "*"),
      body: [headerRow, ...bodyRows]
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => REPORT_COLORS.border,
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3
    },
    margin: [0, 0, 0, 8]
  };
}

export function buildRecommendationCard(input: {
  icon: string;
  title: string;
  description: string;
  priority: "URGENT" | "IMPORTANT" | "CONSEIL";
}): PdfContent {
  const priorityColor =
    input.priority === "URGENT"
      ? REPORT_COLORS.danger
      : input.priority === "IMPORTANT"
        ? REPORT_COLORS.secondary
        : REPORT_COLORS.primary;
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              {
                columns: [
                  { text: input.icon, width: 16 },
                  { text: input.title, style: "h3", bold: true, width: "*" },
                  {
                    text: input.priority,
                    style: "badge",
                    color: priorityColor,
                    alignment: "right"
                  }
                ]
              },
              { text: input.description, style: "small", margin: [16, 2, 0, 0] }
            ],
            fillColor: REPORT_COLORS.lightBg,
            margin: [6, 6, 6, 6]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => REPORT_COLORS.border,
      vLineColor: () => REPORT_COLORS.border
    },
    margin: [0, 0, 0, 6]
  };
}

export function buildTwoColumnLayout(
  leftPct: number,
  left: PdfContent[],
  right: PdfContent[]
): PdfContent {
  return {
    columns: [
      { width: `${leftPct}%`, stack: left },
      { width: `${100 - leftPct}%`, stack: right }
    ],
    columnGap: 12
  };
}

export function buildDivider(): PdfContent {
  return {
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 0.5,
        lineColor: REPORT_COLORS.border
      }
    ],
    margin: [0, 8, 0, 8]
  };
}

export function buildKpiRow(
  label: string,
  value: string,
  valueColor: string = REPORT_COLORS.accent
): PdfContent {
  return {
    columns: [
      { text: label, style: "body", width: "*" },
      { text: value, style: "body", bold: true, color: valueColor, alignment: "right" }
    ],
    margin: [0, 2, 0, 2]
  };
}

export function buildInfographicBlock(
  label: string,
  value: string,
  color: string = REPORT_COLORS.primary
): PdfContent {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              { text: value, fontSize: REPORT_TYPO.h1, bold: true, color, alignment: "center" },
              { text: label, style: "small", alignment: "center", color: REPORT_COLORS.greyText }
            ],
            fillColor: REPORT_COLORS.lightBg,
            margin: [6, 10, 6, 10]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => REPORT_COLORS.border,
      vLineColor: () => REPORT_COLORS.border
    }
  };
}

export function buildPageFooter(ref: string, generatedAt: string): PdfContent {
  return {
    text: `FermierPro · ${ref} · Généré le ${new Date(generatedAt).toLocaleString("fr-FR")}`,
    style: "footer",
    alignment: "center",
    margin: [0, 8, 0, 0]
  };
}
