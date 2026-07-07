"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  adminDeleteChatRoom,
  fetchChatAdminRooms,
  type ChatAdminRoomDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessagesSquare } from "lucide-react";

export default function ChatModerationPage() {
  const t = useTranslations("chatModeration");
  const { token, ready } = useAdminToken();
  const [rooms, setRooms] = useState<ChatAdminRoomDto[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchChatAdminRooms(token);
      setRooms(res.items);
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
    <AdminPageShell wide>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <AdminSection
        icon={MessagesSquare}
        title={t("sections.rooms")}
        description={t("sectionsDesc.rooms")}
        bare
      >
        <Card className="overflow-hidden divide-y">
          {rooms.map((room) => (
            <div key={room.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-semibold">
                    {room.title?.trim() ||
                      room.farmName ||
                      room.marketplaceListingTitle ||
                      t("labels.untitled")}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({room.kind})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("labels.meta", {
                      members: room.memberCount,
                      messages: room.messageCount
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {room.members
                      .map((m) => m.fullName ?? m.email ?? m.userId)
                      .join(" · ")}
                  </p>
                  {room.lastMessage ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {room.lastMessage.senderName ?? "—"}: {room.lastMessage.body}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {new Date(room.updatedAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (!token || !window.confirm(t("confirmDelete"))) {
                      return;
                    }
                    void adminDeleteChatRoom(token, room.id).then(() => reload());
                  }}
                >
                  {t("actions.deleteRoom")}
                </Button>
              </div>
            </div>
          ))}
          {rooms.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">{t("empty.rooms")}</p>
          ) : null}
        </Card>
      </AdminSection>
    </AdminPageShell>
  );
}
