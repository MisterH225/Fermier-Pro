"use client";

import { useTranslations } from "next-intl";
import {
  buildColorScaleSteps,
  MASKED_FILL,
  NO_DATA_FILL,
  type ChoroplethIntensityMetric
} from "./health-map-choropleth";

type Props = {
  maxIntensity: number;
  metric: ChoroplethIntensityMetric;
  className?: string;
};

export function HealthMapChoroplethLegend({
  maxIntensity,
  metric,
  className
}: Props) {
  const t = useTranslations("map.choropleth");
  const steps = buildColorScaleSteps(maxIntensity);

  return (
    <div
      className={className}
      aria-label={t("title")}
    >
      <p className="text-xs font-semibold text-foreground mb-2">
        {t(metric === "farmsAffectedCount" ? "farmsTitle" : "activeCasesTitle")}
      </p>
      <div className="space-y-1.5">
        {steps.map((step) => (
          <div key={`${step.min}-${step.max ?? "max"}`} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 rounded-sm border border-black/10 shrink-0"
              style={{ backgroundColor: step.color }}
            />
            <span className="text-[11px] text-muted-foreground">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-black/10 shrink-0"
            style={{ backgroundColor: NO_DATA_FILL, opacity: 0.65 }}
          />
          <span className="text-[11px] text-muted-foreground">{t("noData")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-5 rounded-sm border border-dashed border-black/20 shrink-0"
            style={{ backgroundColor: MASKED_FILL, opacity: 0.55 }}
          />
          <span className="text-[11px] text-muted-foreground">{t("insufficientData")}</span>
        </div>
      </div>
    </div>
  );
}
