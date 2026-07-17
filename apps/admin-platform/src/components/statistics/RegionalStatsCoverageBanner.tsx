"use client";

import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import type { RegionalStatsCoverage } from "@/lib/api";

type Props = {
  coverage: RegionalStatsCoverage;
};

export function RegionalStatsCoverageBanner({ coverage }: Props) {
  const t = useTranslations("stats.regional");

  return (
    <div className="rounded-2xl border border-brand-olive/20 bg-brand-olive/5 px-4 py-3 text-sm text-foreground">
      <p className="flex items-center gap-2 font-semibold text-brand-olive">
        <BarChart3 className="size-4 shrink-0" aria-hidden />
        {t("coverageTitle")}
      </p>
      <p className="mt-1 text-muted-foreground">
        {t("coverageBody", {
          farms: coverage.farmCount,
          animals: coverage.animalCount,
          departments: coverage.departmentsCovered
        })}
      </p>
    </div>
  );
}
