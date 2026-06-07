"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserListItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BanUserDialog,
  DeleteAccountDialog,
  SendMessageDialog,
  SuspendUserDialog,
  UnsuspendUserDialog,
  WarnUserDialog
} from "./UserModerationDialogs";

const MENU_WIDTH = 220;
const MENU_EST_HEIGHT = 280;
const VIEWPORT_PAD = 8;

type Props = {
  user: UserListItem;
  token: string;
  onRefresh: () => void;
};

type MenuPos = { top: number; left: number; maxHeight: number };

function computeMenuPosition(anchor: DOMRect): MenuPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchor.right - MENU_WIDTH;
  left = Math.max(
    VIEWPORT_PAD,
    Math.min(left, vw - MENU_WIDTH - VIEWPORT_PAD)
  );

  const spaceBelow = vh - anchor.bottom - VIEWPORT_PAD;
  const spaceAbove = anchor.top - VIEWPORT_PAD;
  const openUp = spaceBelow < MENU_EST_HEIGHT && spaceAbove > spaceBelow;

  const maxHeight = Math.max(
    120,
    Math.min(360, openUp ? spaceAbove - 4 : spaceBelow - 4)
  );
  const top = openUp
    ? Math.max(VIEWPORT_PAD, anchor.top - maxHeight - 4)
    : Math.min(anchor.bottom + 4, vh - maxHeight - VIEWPORT_PAD);

  return { top, left, maxHeight };
}

export function UserActionsMenu({ user, token, onRefresh }: Props) {
  const t = useTranslations("users.actions");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [dlg, setDlg] = useState<
    null | "suspend" | "unsuspend" | "ban" | "warn" | "message" | "delete"
  >(null);

  const name = user.fullName ?? user.email ?? user.id;
  const profileTypes = user.profiles.map((p) => p.type);
  const status = user.accountStatus ?? (user.isActive ? "active" : "suspended");

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    setPos(computeMenuPosition(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeAnd = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const menu =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={cn(
              "fixed z-[100] min-w-[200px] rounded-xl border border-border/60",
              "bg-card shadow-lg py-1 text-sm overflow-y-auto overscroll-contain"
            )}
            style={{
              top: pos.top,
              left: pos.left,
              width: MENU_WIDTH,
              maxHeight: pos.maxHeight
            }}
          >
            <Link
              href={`/utilisateurs/${user.id}`}
              role="menuitem"
              className="block px-3 py-2 hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              {t("view")}
            </Link>
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 hover:bg-muted"
              onClick={() => closeAnd(() => setDlg("message"))}
            >
              {t("message")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 hover:bg-muted"
              onClick={() => closeAnd(() => setDlg("warn"))}
            >
              {t("warn")}
            </button>
            <hr className="my-1 border-border/60" />
            {status === "active" ? (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => closeAnd(() => setDlg("suspend"))}
              >
                {t("suspend")}
              </button>
            ) : status === "suspended" ? (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => closeAnd(() => setDlg("unsuspend"))}
              >
                {t("unsuspend")}
              </button>
            ) : null}
            {status !== "banned" ? (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => closeAnd(() => setDlg("ban"))}
              >
                {t("ban")}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50"
              onClick={() => closeAnd(() => setDlg("delete"))}
            >
              {t("delete")}
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("menu")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {menu}

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
    </>
  );
}
