#!/usr/bin/env node
/**
 * Migration mécanique tokens — hex → tokens, radius/fontSize → échelle.
 * Usage: node scripts/migrate-tokens.mjs <file.tsx...>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const THEME = path.join(ROOT, "src/theme");

/** hex upper → { themeFile, expr } — thème nommé pour non-régression */
const COLOR_MAP = {
  "#2F9E44": { theme: "producerTheme", expr: "producerColors.primary" },
  "#EAF7EE": { theme: "producerTheme", expr: "producerColors.primaryLight" },
  "#7A9A3A": { theme: "producerTheme", expr: "producerColors.primarySoft" },
  "#3D5218": { theme: "producerTheme", expr: "producerColors.primaryDark" },
  "#5D7A1F": { theme: "producerTheme", expr: "producerColors.olive" },
  "#1F2910": { theme: "producerTheme", expr: "producerColors.oliveDark" },
  "#6D745B": { theme: "producerTheme", expr: "producerColors.oliveMuted" },
  "#E0E4D4": { theme: "producerTheme", expr: "producerColors.oliveBorder" },
  "#E8E4D4": { theme: "producerTheme", expr: "producerColors.oliveBorderWarm" },
  "#F0F5E4": { theme: "producerTheme", expr: "producerColors.oliveWash" },
  "#EEF4DC": { theme: "producerTheme", expr: "producerColors.oliveWashSoft" },
  "#F6F9E8": { theme: "producerTheme", expr: "producerColors.oliveCanvas" },
  "#FDFCF5": { theme: "producerTheme", expr: "producerColors.oliveCard" },
  "#FDFAF3": { theme: "producerTheme", expr: "producerColors.oliveCard" },
  "#FAF6F0": { theme: "producerTheme", expr: "producerColors.oliveCard" },
  "#4A5238": { theme: "producerTheme", expr: "producerColors.oliveInk" },
  "#A8A99A": { theme: "producerTheme", expr: "producerColors.textMuted" },
  "#6B5420": { theme: "producerTheme", expr: "producerColors.oliveClosedText" },
  "#D4DAC8": { theme: "producerTheme", expr: "producerColors.oliveBorder" },
  "#DFE8C8": { theme: "producerTheme", expr: "producerColors.primaryMuted" },
  "#A34C24": { theme: "producerTheme", expr: "producerColors.accent" },
  "#B00020": { theme: "producerTheme", expr: "producerColors.dangerDeep" },
  "#B42318": { theme: "producerTheme", expr: "producerColors.dangerAlt" },
  "#B45309": { theme: "producerTheme", expr: "producerColors.warningDeep" },
  "#15803D": { theme: "producerTheme", expr: "producerColors.successDeep" },
  "#FFF8E6": { theme: "producerTheme", expr: "producerColors.kpiAmber" },
  "#FEF3C7": { theme: "producerTheme", expr: "producerColors.kpiAmberSoft" },
  "#FFEBEE": { theme: "producerTheme", expr: "producerColors.kpiRose" },
  "#F59E0B": { theme: "producerTheme", expr: "producerColors.warning" },
  "#D64545": { theme: "mobileTheme", expr: "mobileColors.error" },
  "#1F8A3B": { theme: "mobileTheme", expr: "mobileColors.success" },
  "#E3A008": { theme: "mobileTheme", expr: "mobileColors.warning" },
  "#111111": { theme: "mobileTheme", expr: "mobileColors.textPrimary" },
  "#6B6B6B": { theme: "mobileTheme", expr: "mobileColors.textSecondary" },
  "#4B513D": { theme: "mobileTheme", expr: "mobileColors.textTertiary" },
  "#E8E8E8": { theme: "mobileTheme", expr: "mobileColors.border" },
  "#F2F2F7": { theme: "mobileTheme", expr: "mobileColors.canvas" },
  "#FAFAFA": { theme: "mobileTheme", expr: "mobileColors.surface" },
  "#F7F7F7": { theme: "mobileTheme", expr: "mobileColors.surfaceMuted" },
  "#FFFFFF": { theme: "mobileTheme", expr: "mobileColors.background" },
  "#FFF": { theme: "mobileTheme", expr: "mobileColors.background" },
  "#000000": { theme: "mobileTheme", expr: "mobileColors.shadow" },
  "#000": { theme: "mobileTheme", expr: "mobileColors.shadow" },
  "#DCFCE7": { theme: "mobileTheme", expr: "mobileStatusSurfaces.successBg" },
  "#166534": { theme: "mobileTheme", expr: "mobileStatusSurfaces.successText" },
  "#FFF3E0": { theme: "mobileTheme", expr: "mobileStatusSurfaces.warningBg" },
  "#F57F17": { theme: "mobileTheme", expr: "mobileStatusSurfaces.warningText" },
  "#E3F2FD": { theme: "mobileTheme", expr: "mobileStatusSurfaces.infoBg" },
  "#1565C0": { theme: "mobileTheme", expr: "mobileStatusSurfaces.infoText" },
  "#E8F5E9": { theme: "mobileTheme", expr: "mobileStatusSurfaces.positiveBg" },
  "#2E7D32": { theme: "mobileTheme", expr: "mobileStatusSurfaces.positiveText" },
  "#FEE2E2": { theme: "mobileTheme", expr: "mobileStatusSurfaces.errorBg" },
  "#FFF8E1": { theme: "mobileTheme", expr: "mobileKpiPalette.dueMonth.bg" },
  "#FF8C00": { theme: "mobileTheme", expr: "mobileKpiPalette.gestation.accent" },
  "#F97316": { theme: "mobileTheme", expr: "mobileKpiPalette.gestation.accent" },
  "#C4A574": { theme: "marketplaceTheme", expr: "marketplaceColors.handover" },
  "#F0E8D8": { theme: "marketplaceTheme", expr: "marketplaceColors.closedBg" },
  "#D97706": { theme: "marketplaceTheme", expr: "marketplaceColors.pending" },
  "#2D5A6E": { theme: "marketplaceTheme", expr: "marketplaceColors.reservedText" },
  "#E8F4F8": { theme: "marketplaceTheme", expr: "marketplaceColors.reservedBg" },
  "#8B4513": { theme: "marketplaceTheme", expr: "marketplaceColors.note" },
  "#999999": { theme: "marketplaceTheme", expr: "marketplaceColors.placeholder" },
  "#9AA088": { theme: "producerTheme", expr: "producerColors.olivePlaceholder" },
  "#E8EFD9": { theme: "producerTheme", expr: "producerColors.oliveChipBg" },
  "#E8F5E4": { theme: "producerTheme", expr: "producerColors.oliveOnlineBg" },
  "#2D5016": { theme: "producerTheme", expr: "producerColors.oliveOnlineFg" },
  "#43A047": { theme: "producerTheme", expr: "producerColors.oliveOnlineDot" },
  "#EDECE4": { theme: "producerTheme", expr: "producerColors.oliveNeutralBg" },
  "#4A6118": { theme: "producerTheme", expr: "producerColors.oliveComposerBorder" },
  "#D4E8D0": { theme: "producerTheme", expr: "producerColors.oliveBannerBorder" },
  "#FDECEA": { theme: "producerTheme", expr: "producerColors.dangerSoftBg" },
  "#FEF2F2": { theme: "producerTheme", expr: "producerColors.errorSoftBg" },
  "#E0E7FF": { theme: "producerTheme", expr: "producerColors.financeIndigoBg" },
  "#3730A3": { theme: "producerTheme", expr: "producerColors.financeIndigoText" },
  "#3B82F6": { theme: "producerTheme", expr: "producerColors.chartBlue" },
  "#EAB308": { theme: "producerTheme", expr: "producerColors.chartYellow" },
  "#22C55E": { theme: "producerTheme", expr: "producerColors.chartGreen" },
  "#4A90A4": { theme: "producerTheme", expr: "producerColors.moduleTealBorder" },
  "#EEF6F8": { theme: "producerTheme", expr: "producerColors.moduleTealBg" },
  "#6B7CB8": { theme: "producerTheme", expr: "producerColors.moduleIndigoBorder" },
  "#F2F4FB": { theme: "producerTheme", expr: "producerColors.moduleIndigoBg" },
  "#3D4D78": { theme: "producerTheme", expr: "producerColors.moduleIndigoText" },
  "#A67C52": { theme: "producerTheme", expr: "producerColors.moduleBrownBorder" },
  "#5C4428": { theme: "producerTheme", expr: "producerColors.moduleBrownText" },
  "#6B6E9C": { theme: "producerTheme", expr: "producerColors.moduleSlateBorder" },
  "#F4F4FB": { theme: "producerTheme", expr: "producerColors.moduleSlateBg" },
  "#3A3D6B": { theme: "producerTheme", expr: "producerColors.moduleSlateText" },
  "#8FAA3C": { theme: "producerTheme", expr: "producerColors.moduleLimeBorder" },
  "#4D6318": { theme: "producerTheme", expr: "producerColors.moduleLimeText" },
  "#EEF6D8": { theme: "producerTheme", expr: "producerColors.memberChipBg" },
  "#C5D99A": { theme: "producerTheme", expr: "producerColors.memberChipBorder" },
  "#E8E6D8": { theme: "producerTheme", expr: "producerColors.memberCardBorder" },
  "#ECFDF5": { theme: "producerTheme", expr: "producerColors.successMintBg" },
  "#B91C1C": { theme: "producerTheme", expr: "producerColors.dangerStrong" },
  "#C47A6A": { theme: "producerTheme", expr: "producerColors.coralBorder" },
  "#229ED9": { theme: "producerTheme", expr: "producerColors.telegram" },
  "#229ED918": { theme: "producerTheme", expr: "producerColors.telegramSoft" },
  // vet (for zone vet)
  "#2B7FFF": { theme: "vetTheme", expr: "vetColors.primary" },
  "#E8F1FF": { theme: "vetTheme", expr: "vetColors.primaryLight" },
  "#EFF3F9": { theme: "vetTheme", expr: "vetColors.canvas" },
  "#F5F8FC": { theme: "vetTheme", expr: "vetColors.background" },
  "#1A1D23": { theme: "vetTheme", expr: "vetColors.textPrimary" },
  "#8B95A8": { theme: "vetTheme", expr: "vetColors.textSecondary" },
  "#10B981": { theme: "vetTheme", expr: "vetColors.success" },
  "#EF4444": { theme: "vetTheme", expr: "vetColors.danger" },
  "#E3F0FF": { theme: "vetTheme", expr: "vetColors.kpiBlue" },
  "#E8F8F0": { theme: "vetTheme", expr: "vetColors.kpiGreen" },
  "#FCE8F0": { theme: "vetTheme", expr: "vetColors.kpiRose" },
  // buyer
  "#7C3AED": { theme: "buyerTheme", expr: "buyerColors.primary" },
  "#F5F0FF": { theme: "buyerTheme", expr: "buyerColors.primaryLight" },
  "#FAF7FF": { theme: "buyerTheme", expr: "buyerColors.canvas" },
  "#5B21B6": { theme: "buyerTheme", expr: "buyerColors.primaryDark" },
  // merchant
  "#C45C26": { theme: "merchantTheme", expr: "merchantColors.primary" },
  "#FFF4ED": { theme: "merchantTheme", expr: "merchantColors.primaryLight" },
  "#FFF8F3": { theme: "merchantTheme", expr: "merchantColors.canvas" },
  "#E07A3D": { theme: "merchantTheme", expr: "merchantColors.accent" },
  "#9A4218": { theme: "merchantTheme", expr: "merchantColors.primaryDark" },
  "#92400E": { theme: "merchantTheme", expr: "merchantColors.amberText" },
  "#78350F": { theme: "merchantTheme", expr: "merchantColors.amberTextDeep" },
  "#FCE4EC": { theme: "merchantTheme", expr: "merchantColors.roseSoftBg" },
  "#DBEAFE": { theme: "merchantTheme", expr: "merchantColors.blueSoftBg" },
  "#1E40AF": { theme: "merchantTheme", expr: "merchantColors.blueText" },
  "#1E3A8A": { theme: "merchantTheme", expr: "merchantColors.blueTextDeep" },
  "#047857": { theme: "merchantTheme", expr: "merchantColors.greenText" },
  // tech
  "#FF6B35": { theme: "technicianTheme", expr: "techColors.primary" },
  "#FFF0EB": { theme: "technicianTheme", expr: "techColors.primaryLight" },
  "#FFF8F5": { theme: "technicianTheme", expr: "techColors.canvas" },
  "#FF8F66": { theme: "technicianTheme", expr: "techColors.primarySoft" }
};

function normalizeHex(h) {
  const u = h.toUpperCase();
  if (u === "#FFF") return "#FFFFFF";
  if (u === "#000") return "#000000";
  if (/^#[0-9A-F]{3}$/.test(u)) {
    return `#${u[1]}${u[1]}${u[2]}${u[2]}${u[3]}${u[3]}`;
  }
  return u;
}

function nearestRadius(n) {
  if (n >= 99) return 999;
  const scale = [8, 12, 16, 22, 999];
  let best = scale[0];
  let bestDist = Math.abs(n - best);
  for (const s of scale) {
    const d = Math.abs(n - s);
    if (d < bestDist || (d === bestDist && s > best)) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

function nearestFont(n) {
  const scale = [11, 13, 15, 17, 22, 28];
  let best = scale[0];
  let bestDist = Math.abs(n - best);
  for (const s of scale) {
    const d = Math.abs(n - s);
    if (d < bestDist || (d === bestDist && s > best)) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

const RADIUS_TOKEN = {
  8: "mobileRadius.sm",
  12: "mobileRadius.md",
  16: "mobileRadius.lg",
  22: "mobileRadius.xl",
  999: "mobileRadius.pill"
};

const FONT_TOKEN = {
  11: "mobileFontSize.xs",
  13: "mobileFontSize.sm",
  15: "mobileFontSize.md",
  17: "mobileFontSize.lg",
  22: "mobileFontSize.xl",
  28: "mobileFontSize.xxl"
};

function relImport(fromFile, themeFile) {
  let rel = path.relative(path.dirname(fromFile), path.join(THEME, themeFile)).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function ensureImport(src, importPath, names) {
  const needed = [...names];
  const escaped = importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importRe = new RegExp(
    `import\\s*\\{([^}]+)\\}\\s*from\\s*["']${escaped}["'];?`
  );
  const m = src.match(importRe);
  if (m) {
    const existing = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const missing = needed.filter((n) => !existing.includes(n));
    if (missing.length === 0) return src;
    return src.replace(
      m[0],
      `import { ${[...new Set([...existing, ...missing])].join(", ")} } from "${importPath}";`
    );
  }
  const lines = src.split("\n");
  let insertAt = 0;
  let inImport = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^import\b/.test(line)) {
      inImport = !(line.includes(" from ") || /;\\s*$/.test(line) || line.trim().endsWith(";"));
      insertAt = i + 1;
      if (line.includes(" from ") || line.trim().endsWith(";")) inImport = false;
      continue;
    }
    if (inImport) {
      insertAt = i + 1;
      if (line.includes(" from ") || line.trim().endsWith(";")) inImport = false;
      continue;
    }
    break;
  }
  lines.splice(insertAt, 0, `import { ${needed.join(", ")} } from "${importPath}";`);
  return lines.join("\n");
}

function migrateFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const original = src;
  /** @type {Map<string, Set<string>>} */
  const imports = new Map();

  const track = (theme, binding) => {
    const importPath = relImport(filePath, theme);
    if (!imports.has(importPath)) imports.set(importPath, new Set());
    imports.get(importPath).add(binding);
  };

  // JSX attr="hex" → attr={token} ; StyleSheet / JS "hex" → token
  src = src.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*=)["'](#[0-9A-Fa-f]{3,8})["']/g,
    (full, attrEq, hex) => {
      const key = normalizeHex(hex);
      const mapped = COLOR_MAP[key];
      if (!mapped) return full;
      const binding = mapped.expr.split(".")[0];
      track(mapped.theme, binding);
      return `${attrEq}{${mapped.expr}}`;
    }
  );
  src = src.replace(/["'](#[0-9A-Fa-f]{3,8})["']/g, (full, hex) => {
    const key = normalizeHex(hex);
    const mapped = COLOR_MAP[key];
    if (!mapped) return full;
    const binding = mapped.expr.split(".")[0];
    track(mapped.theme, binding);
    return mapped.expr;
  });

  src = src.replace(/borderRadius:\s*(\d+(?:\.\d+)?)/g, (full, numStr) => {
    const nearest = nearestRadius(Number(numStr));
    const token = RADIUS_TOKEN[nearest];
    track("mobileTheme", "mobileRadius");
    return `borderRadius: ${token}`;
  });

  src = src.replace(/fontSize:\s*(\d+(?:\.\d+)?)/g, (full, numStr) => {
    const nearest = nearestFont(Number(numStr));
    const token = FONT_TOKEN[nearest];
    track("mobileTheme", "mobileFontSize");
    return `fontSize: ${token}`;
  });

  if (src === original) return false;

  for (const [importPath, names] of imports) {
    src = ensureImport(src, importPath, [...names]);
  }
  fs.writeFileSync(filePath, src);
  return true;
}

let changed = 0;
for (const arg of process.argv.slice(2)) {
  const abs = path.resolve(arg);
  if (!fs.existsSync(abs)) {
    console.warn("missing", arg);
    continue;
  }
  if (migrateFile(abs)) {
    changed++;
    console.log("migrated", path.relative(process.cwd(), abs));
  }
}
console.log(`Done. ${changed} files changed.`);
