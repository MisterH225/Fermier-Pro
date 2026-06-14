"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminRecomputeProducerScore,
  adminSetProducerCreditBlocked,
  fetchAdminProducerScores,
  type AdminProducerScoreDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SCORE_FILTERS = ["", "excellent", "bon", "nouveau", "attention", "risque"] as const;

export default function ProducerScoresPage() {
  const t = useTranslations("producerScores");
  const { token, ready } = useAdminToken();
  const [rows, setRows] = useState<AdminProducerScoreDto[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminProducerScores(token, filter || undefined);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !token) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-wrap gap-2">
        {SCORE_FILTERS.map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s ? t(`scores.${s}`) : t("filterAll")}
          </Button>
        ))}
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          {t("refresh")}
        </Button>
      </div>

      {loading ? <PageSkeleton /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.userId} className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {row.emoji} {row.label} · {row.globalValue}/100
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.user.fullName ?? "—"} · {row.user.email ?? row.user.phone ?? row.userId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("pillars", {
                    data: row.dataRegularityScore,
                    usage: row.platformUsageScore,
                    resp: row.responsivenessScore
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("chat", {
                    replied: row.chatRepliedWithin24h,
                    total: row.chatBuyerMessagesCount
                  })}
                </p>
                {row.creditBlocked && row.creditBlockedReason ? (
                  <p className="text-xs text-destructive">{row.creditBlockedReason}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminRecomputeProducerScore(token, row.userId).then(() => load())
                  }
                >
                  {t("recompute")}
                </Button>
                {row.creditBlocked ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void adminSetProducerCreditBlocked(token, row.userId, false).then(() =>
                        load()
                      )
                    }
                  >
                    {t("unblockCredit")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const reason = window.prompt(t("blockReasonPrompt"));
                      if (reason === null) return;
                      void adminSetProducerCreditBlocked(token, row.userId, true, reason).then(
                        () => load()
                      );
                    }}
                  >
                    {t("blockCredit")}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {!loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}
