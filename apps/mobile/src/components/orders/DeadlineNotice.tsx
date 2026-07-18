import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ordersPalette, type OrderPalette } from "./orderTheme";

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  deadlineAt: string;
  /** Clé i18n de la conséquence réelle au timeout (P-43). */
  outcomeKey?: string | null;
  /**
   * Clé i18n optionnelle pour la ligne d'échéance (compat bandeau historique,
   * ex. "orders.respondBefore"). Ignorée quand un compte à rebours < 24 h
   * s'affiche. Par défaut : "deadline.byDate".
   */
  labelKey?: string;
  palette?: OrderPalette;
};

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

/**
 * Composant unique (P-43) pour toute échéance : ligne d'échéance + phrase de
 * conséquence. Compte à rebours seulement quand l'échéance est < 24 h ;
 * au-delà, la date suffit (un décompte de plusieurs jours angoisse plus qu'il
 * n'informe). Remplace OrderDeadlineBanner et CountdownBalance.
 */
export function DeadlineNotice({
  deadlineAt,
  outcomeKey,
  labelKey,
  palette = ordersPalette
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const [now, setNow] = useState(() => Date.now());

  const target = useMemo(() => new Date(deadlineAt).getTime(), [deadlineAt]);
  const invalid = Number.isNaN(target);
  const msLeft = target - now;
  const isCountdown = !invalid && msLeft > 0 && msLeft < DAY_MS;

  useEffect(() => {
    if (!isCountdown) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isCountdown]);

  const deadlineLine = useMemo(() => {
    if (invalid) {
      return labelKey ? t(labelKey, { when: deadlineAt }) : deadlineAt;
    }
    if (msLeft <= 0) {
      return t("deadline.overdue");
    }
    if (isCountdown) {
      const totalMin = Math.max(1, Math.round(msLeft / 60_000));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return h > 0
        ? t("deadline.countdownHours", { h, m })
        : t("deadline.countdownMinutes", { m });
    }
    const when = formatDate(deadlineAt, locale);
    return labelKey ? t(labelKey, { when }) : t("deadline.byDate", { when });
  }, [invalid, msLeft, isCountdown, deadlineAt, labelKey, locale, t]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.deadline, { color: palette.warning }]}>
        {deadlineLine}
      </Text>
      {outcomeKey ? (
        <Text style={[styles.outcome, { color: palette.textSecondary }]}>
          {t(outcomeKey)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  deadline: {
    fontWeight: "700",
    fontSize: 13
  },
  outcome: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17
  }
});
