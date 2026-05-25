"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserListItem } from "@/lib/api";
import {
  BanUserDialog,
  DeleteAccountDialog,
  SendMessageDialog,
  SuspendUserDialog,
  UnsuspendUserDialog,
  WarnUserDialog
} from "./UserModerationDialogs";

type Props = {
  user: UserListItem;
  token: string;
  onRefresh: () => void;
};

export function UserActionsMenu({ user, token, onRefresh }: Props) {
  const t = useTranslations("users.actions");
  const [open, setOpen] = useState(false);
  const [dlg, setDlg] = useState<
    null | "suspend" | "unsuspend" | "ban" | "warn" | "message" | "delete"
  >(null);

  const name = user.fullName ?? user.email ?? user.id;
  const profileTypes = user.profiles.map((p) => p.type);
  const status = user.accountStatus ?? (user.isActive ? "active" : "suspended");

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menu")}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border bg-card shadow-lg py-1 text-sm">
            <Link
              href={`/utilisateurs/${user.id}`}
              className="block px-3 py-2 hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              {t("view")}
            </Link>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted"
              onClick={() => {
                setOpen(false);
                setDlg("message");
              }}
            >
              {t("message")}
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted"
              onClick={() => {
                setOpen(false);
                setDlg("warn");
              }}
            >
              {t("warn")}
            </button>
            <hr className="my-1 border-border/60" />
            {status === "active" ? (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  setDlg("suspend");
                }}
              >
                {t("suspend")}
              </button>
            ) : status === "suspended" ? (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  setDlg("unsuspend");
                }}
              >
                {t("unsuspend")}
              </button>
            ) : null}
            {status !== "banned" ? (
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  setDlg("ban");
                }}
              >
                {t("ban")}
              </button>
            ) : null}
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50"
              onClick={() => {
                setOpen(false);
                setDlg("delete");
              }}
            >
              {t("delete")}
            </button>
          </div>
        </>
      ) : null}

      {dlg === "suspend" ? (
        <SuspendUserDialog
          open
          onClose={() => setDlg(null)}
          token={token}
          userId={user.id}
          userName={name}
          profileTypes={profileTypes}
          onSuccess={onRefresh}
        />
      ) : null}
      {dlg === "unsuspend" ? (
        <UnsuspendUserDialog
          open
          onClose={() => setDlg(null)}
          token={token}
          userId={user.id}
          onSuccess={onRefresh}
        />
      ) : null}
      {dlg === "ban" ? (
        <BanUserDialog
          open
          onClose={() => setDlg(null)}
          token={token}
          userId={user.id}
          userName={name}
          profileTypes={profileTypes}
          onSuccess={onRefresh}
        />
      ) : null}
      {dlg === "warn" ? (
        <WarnUserDialog
          open
          onClose={() => setDlg(null)}
          token={token}
          userId={user.id}
          onSuccess={onRefresh}
        />
      ) : null}
      {dlg === "message" ? (
        <SendMessageDialog
          open
          onClose={() => setDlg(null)}
          token={token}
          userId={user.id}
          onSuccess={onRefresh}
        />
      ) : null}
      {dlg === "delete" ? (
        <DeleteAccountDialog
          open
          onClose={() => setDlg(null)}
          token={token}
          userId={user.id}
          userName={name}
          onSuccess={onRefresh}
        />
      ) : null}
    </div>
  );
}
