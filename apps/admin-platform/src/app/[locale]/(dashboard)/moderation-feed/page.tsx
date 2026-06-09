"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminUnsanctionFeedUser,
  fetchFeedAppeals,
  fetchFeedModerationEvents,
  fetchFeedSanctionedUsers,
  resolveFeedAppeal,
  type FeedAppealDto,
  type FeedModerationEventDto,
  type FeedSanctionedUserDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function FeedModerationPage() {
  const t = useTranslations("feedModeration");
  const { token, ready } = useAdminToken();
  const [events, setEvents] = useState<FeedModerationEventDto[]>([]);
  const [users, setUsers] = useState<FeedSanctionedUserDto[]>([]);
  const [appeals, setAppeals] = useState<FeedAppealDto[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ev, us, ap] = await Promise.all([
        fetchFeedModerationEvents(token),
        fetchFeedSanctionedUsers(token),
        fetchFeedAppeals(token, "pending")
      ]);
      setEvents(ev);
      setUsers(us);
      setAppeals(ap);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!ready || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("sections.events")}</h2>
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">{t("columns.date")}</th>
                  <th className="px-4 py-3">{t("columns.user")}</th>
                  <th className="px-4 py-3">{t("columns.type")}</th>
                  <th className="px-4 py-3">{t("columns.severity")}</th>
                  <th className="px-4 py-3">{t("columns.confidence")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">{e.userName ?? e.userEmail ?? e.userId}</td>
                    <td className="px-4 py-3">{e.violationType}</td>
                    <td className="px-4 py-3">{e.severity}</td>
                    <td className="px-4 py-3">
                      {e.aiConfidence != null ? `${Math.round(e.aiConfidence * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t("empty.events")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("sections.sanctioned")}</h2>
        <Card className="rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">{t("columns.user")}</th>
                  <th className="px-4 py-3">{t("columns.status")}</th>
                  <th className="px-4 py-3">{t("columns.until")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{u.fullName ?? u.email ?? u.id}</td>
                    <td className="px-4 py-3">{u.feedStatus}</td>
                    <td className="px-4 py-3">
                      {u.feedSuspensionUntil
                        ? new Date(u.feedSuspensionUntil).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          token &&
                          void adminUnsanctionFeedUser(token, u.id).then(() => reload())
                        }
                      >
                        {t("actions.unsanction")}
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {t("empty.sanctioned")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("sections.appeals")}</h2>
        <Card className="rounded-2xl overflow-hidden divide-y">
          {appeals.map((a) => (
            <div key={a.id} className="p-4 space-y-2">
              <div className="text-sm font-medium">
                {a.userName ?? a.userEmail} — {a.feedStatus}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {a.appealMessage}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    token &&
                    void resolveFeedAppeal(token, a.id, {
                      accepted: true,
                      adminResponse: t("appealAcceptedDefault")
                    }).then(() => reload())
                  }
                >
                  {t("actions.acceptAppeal")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    token &&
                    void resolveFeedAppeal(token, a.id, {
                      accepted: false,
                      adminResponse: t("appealRejectedDefault")
                    }).then(() => reload())
                  }
                >
                  {t("actions.rejectAppeal")}
                </Button>
              </div>
            </div>
          ))}
          {appeals.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">{t("empty.appeals")}</p>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
