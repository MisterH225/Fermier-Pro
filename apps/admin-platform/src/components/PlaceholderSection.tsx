"use client";

import { useTranslations } from "next-intl";

export function PlaceholderSection() {
  const t = useTranslations("common");
  return (
    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
      <p className="text-slate-600">{t("comingSoon")}</p>
    </div>
  );
}
