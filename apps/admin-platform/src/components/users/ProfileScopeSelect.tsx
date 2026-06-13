"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import type { ModerationScope } from "@/lib/moderation";
import { selectClass } from "@/lib/ui-styles";

type Props = {
  profileTypes: string[];
  value: ModerationScope;
  onChange: (scope: ModerationScope) => void;
  showLabel?: boolean;
};

export function ProfileScopeSelect({
  profileTypes,
  value,
  onChange,
  showLabel = true
}: Props) {
  const t = useTranslations("users.moderation");

  if (profileTypes.length <= 1) {
    return null;
  }

  return (
    <div>
      {showLabel ? <Label>{t("scope")}</Label> : null}
      <select
        className={showLabel ? `${selectClass} mt-1` : selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value as ModerationScope)}
      >
        <option value="account">{t("scopeAccount")}</option>
        {profileTypes.includes("veterinarian") ? (
          <option value="veterinarian">{t("scopeVet")}</option>
        ) : null}
        {profileTypes.includes("producer") ? (
          <option value="producer">{t("scopeProducer")}</option>
        ) : null}
        {profileTypes.includes("technician") ? (
          <option value="technician">{t("scopeTechnician")}</option>
        ) : null}
        {profileTypes.includes("buyer") ? (
          <option value="buyer">{t("scopeBuyer")}</option>
        ) : null}
      </select>
    </div>
  );
}
