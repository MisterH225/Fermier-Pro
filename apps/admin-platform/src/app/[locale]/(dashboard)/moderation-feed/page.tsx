"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminDeleteFeedComment,
  adminDeleteFeedPost,
  adminUnsanctionFeedUser,
  fetchFeedAdminPosts,
  fetchFeedAppeals,
  fetchFeedModerationEvents,
  fetchFeedSanctionedUsers,
  resolveFeedAppeal,
  type FeedAdminCommentDto,
  type FeedAdminPostDto,
  type FeedAppealDto,
  type FeedModerationEventDto,
  type FeedSanctionedUserDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Gavel, ShieldAlert } from "lucide-react";

function AdminCommentRow({
  comment,
  depth,
  token,
  onDeleted
}: {
  comment: FeedAdminCommentDto;
  depth: number;
  token: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("feedModeration");
  const author =
    comment.isAnonymous
      ? comment.authorRegion ?? "Anonyme"
      : comment.authorName ?? comment.authorDisplayName ?? comment.authorEmail ?? comment.authorUserId;

  const handleDelete = () => {
    if (!window.confirm(t("content.confirmDeleteComment"))) {
      return;
    }
    void adminDeleteFeedComment(token, comment.id).then(() => onDeleted());
  };

  return (
    <div style={{ marginLeft: depth * 16 }} className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-white/30 p-3 text-sm">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-medium">
            {author}
            {comment.isRemoved ? (
              <span className="ml-2 text-xs text-destructive">({t("content.removed")})</span>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString("fr-FR")} · {t("content.likes", { count: comment.likeCount })}
          </p>
        </div>
        {!comment.isRemoved ? (
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            {t("actions.deleteComment")}
          </Button>
        ) : null}
      </div>
      {comment.replies.map((reply) => (
        <AdminCommentRow
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          token={token}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  );
}

function AdminPostCard({
  post,
  token,
  onDeleted
}: {
  post: FeedAdminPostDto;
  token: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("feedModeration");
  const author =
    post.isAnonymous
      ? post.authorRegion ?? "Anonyme"
      : post.authorName ?? post.authorDisplayName ?? post.authorEmail ?? post.authorUserId;

  const handleDelete = () => {
    if (!window.confirm(t("content.confirmDeletePost"))) {
      return;
    }
    void adminDeleteFeedPost(token, post.id).then(() => onDeleted());
  };

  return (
    <div className="space-y-3 border-b p-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-semibold">
            {author} · {post.postType}
            {post.isRemoved ? (
              <span className="ml-2 text-xs font-normal text-destructive">
                ({t("content.removed")})
              </span>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap text-sm">{post.body}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(post.createdAt).toLocaleString("fr-FR")} ·{" "}
            {t("content.likes", { count: post.likeCount })} ·{" "}
            {t("content.comments", { count: post.commentCount })}
          </p>
        </div>
        {!post.isRemoved ? (
          <Button size="sm" variant="destructive" onClick={handleDelete}>
            {t("actions.deletePost")}
          </Button>
        ) : null}
      </div>
      {post.comments.length > 0 ? (
        <div className="space-y-2">
          {post.comments.map((comment) => (
            <AdminCommentRow
              key={comment.id}
              comment={comment}
              depth={0}
              token={token}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FeedModerationPage() {
  const t = useTranslations("feedModeration");
  const { token, ready } = useAdminToken();
  const [events, setEvents] = useState<FeedModerationEventDto[]>([]);
  const [users, setUsers] = useState<FeedSanctionedUserDto[]>([]);
  const [appeals, setAppeals] = useState<FeedAppealDto[]>([]);
  const [posts, setPosts] = useState<FeedAdminPostDto[]>([]);
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ev, us, ap, feedPosts] = await Promise.all([
        fetchFeedModerationEvents(token),
        fetchFeedSanctionedUsers(token),
        fetchFeedAppeals(token, "pending"),
        fetchFeedAdminPosts(token, 1, includeRemoved)
      ]);
      setEvents(ev);
      setUsers(us);
      setAppeals(ap);
      setPosts(feedPosts.items);
    } finally {
      setLoading(false);
    }
  }, [token, includeRemoved]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!ready || loading) {
    return <PageSkeleton />;
  }

  return (
    <AdminPageShell wide>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <AdminSection
        id="content"
        icon={FileText}
        title={t("sections.content")}
        description={t("sectionsDesc.content")}
        footer={
          <Button
            size="sm"
            variant={includeRemoved ? "default" : "outline"}
            onClick={() => setIncludeRemoved((v) => !v)}
          >
            {t("actions.showRemoved")}
          </Button>
        }
        bare
      >
        <Card className="overflow-hidden divide-y">
          {posts.map((post) => (
            <AdminPostCard key={post.id} post={post} token={token!} onDeleted={() => void reload()} />
          ))}
          {posts.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">{t("empty.content")}</p>
          ) : null}
        </Card>
      </AdminSection>

      <AdminSection
        id="events"
        icon={AlertTriangle}
        title={t("sections.events")}
        description={t("sectionsDesc.events")}
        bare
      >
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white/40 backdrop-blur-sm text-left text-xs uppercase text-muted-foreground">
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
      </AdminSection>

      <AdminSection
        id="sanctioned"
        icon={ShieldAlert}
        title={t("sections.sanctioned")}
        description={t("sectionsDesc.sanctioned")}
        bare
      >
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white/40 backdrop-blur-sm text-left text-xs uppercase text-muted-foreground">
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
      </AdminSection>

      <AdminSection
        id="appeals"
        icon={Gavel}
        title={t("sections.appeals")}
        description={t("sectionsDesc.appeals")}
        bare
      >
        <Card className="overflow-hidden divide-y">
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
      </AdminSection>
    </AdminPageShell>
  );
}
