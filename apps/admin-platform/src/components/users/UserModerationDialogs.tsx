"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ModerationScope } from "@/lib/moderation";
import {
  banUser,
  deleteUserAccount,
  sendAdminMessage,
  sendBulkAdminMessage,
  suspendUser,
  unbanUser,
  unsuspendUser,
  warnUser
} from "@/lib/moderation";
import { ProfileScopeSelect } from "./ProfileScopeSelect";

const REASONS = [
  "Violation des CGU",
  "Contenu frauduleux",
  "Comportement abusif",
  "Informations incorrectes",
  "Signalement utilisateur",
  "Autre"
] as const;

const DURATIONS = ["24h", "7 jours", "30 jours", "Indéfinie"] as const;

type BaseProps = {
  open: boolean;
  onClose: () => void;
  token: string;
  userId: string;
  userName: string;
  profileTypes: string[];
  onSuccess: () => void;
};

export function SuspendUserDialog({
  open,
  onClose,
  token,
  userId,
  userName,
  profileTypes,
  onSuccess
}: BaseProps) {
  const t = useTranslations("users.moderation");
  const [scope, setScope] = useState<ModerationScope>("account");
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [duration, setDuration] = useState<string>(DURATIONS[1]);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (confirm !== "SUSPENDRE") return;
    setBusy(true);
    setErr(null);
    try {
      await suspendUser(token, userId, { scope, reason, details, duration, notifyUser: true });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("suspendTitle", { name: userName })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ProfileScopeSelect
            profileTypes={profileTypes}
            value={scope}
            onChange={setScope}
          />
          <div>
            <Label>{t("reason")}</Label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {scope === "account" ? (
            <div>
              <Label>{t("duration")}</Label>
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("durationAccountOnly")}</p>
          )}
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("details")} />
          <div>
            <Label>{t("confirmPhrase", { phrase: "SUSPENDRE" })}</Label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" />
          </div>
          {err ? <p className="text-destructive text-xs">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={busy || confirm !== "SUSPENDRE"} onClick={() => void submit()}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnsuspendUserDialog({
  open,
  onClose,
  token,
  userId,
  profileTypes,
  onSuccess
}: Omit<BaseProps, "userName">) {
  const t = useTranslations("users.moderation");
  const [scope, setScope] = useState<ModerationScope>("account");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await unsuspendUser(token, userId, { scope, notifyUser: true });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("unsuspendTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ProfileScopeSelect
            profileTypes={profileTypes}
            value={scope}
            onChange={setScope}
          />
          {err ? <p className="text-destructive text-xs">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnbanUserDialog({
  open,
  onClose,
  token,
  userId,
  profileTypes,
  onSuccess
}: Omit<BaseProps, "userName">) {
  const t = useTranslations("users.moderation");
  const [scope, setScope] = useState<ModerationScope>("account");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await unbanUser(token, userId, { scope, notifyUser: true });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("unbanTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ProfileScopeSelect
            profileTypes={profileTypes}
            value={scope}
            onChange={setScope}
          />
          {err ? <p className="text-destructive text-xs">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BanUserDialog({
  open,
  onClose,
  token,
  userId,
  userName,
  profileTypes,
  onSuccess
}: BaseProps) {
  const t = useTranslations("users.moderation");
  const [scope, setScope] = useState<ModerationScope>("account");
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (confirm !== "BANNIR" || !details.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await banUser(token, userId, { scope, reason, details, notifyUser: true });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("banTitle", { name: userName })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
          {t("banWarning")}
        </p>
        <div className="space-y-3 text-sm">
          <ProfileScopeSelect
            profileTypes={profileTypes}
            value={scope}
            onChange={setScope}
            showLabel={false}
          />
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Textarea required value={details} onChange={(e) => setDetails(e.target.value)} />
          <Input
            placeholder="BANNIR"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {err ? <p className="text-destructive text-xs">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy || confirm !== "BANNIR" || !details.trim()}
            onClick={() => void submit()}
          >
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WarnUserDialog({ open, onClose, token, userId, onSuccess }: Omit<BaseProps, "userName" | "profileTypes">) {
  const t = useTranslations("users.moderation");
  const [motive, setMotive] = useState<string>(REASONS[0]);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("1er avertissement");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await warnUser(token, userId, {
        motive,
        message,
        warningLevel: level,
        notifyUser: true
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("warnTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={motive}
            onChange={(e) => setMotive(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option>1er avertissement</option>
            <option>2ème avertissement</option>
            <option>Avertissement final</option>
          </select>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={busy || !message.trim()} onClick={() => void submit()}>
            {t("send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SendMessageDialog({
  open,
  onClose,
  token,
  userId,
  onSuccess
}: Omit<BaseProps, "userName" | "profileTypes">) {
  const t = useTranslations("users.moderation");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "notification">("info");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await sendAdminMessage(token, {
        userId,
        subject,
        message,
        type,
        sendPush: true
      });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("messageTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subject")} />
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="info">{t("messageTypes.info")}</option>
            <option value="warning">{t("messageTypes.warning")}</option>
            <option value="notification">{t("messageTypes.notification")}</option>
          </select>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={busy || !subject.trim() || !message.trim()} onClick={() => void submit()}>
            {t("send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type BulkMessageDialogProps = {
  open: boolean;
  onClose: () => void;
  token: string;
  userIds: string[];
  onSuccess: (count: number) => void;
};

export function BulkSendMessageDialog({
  open,
  onClose,
  token,
  userIds,
  onSuccess
}: BulkMessageDialogProps) {
  const t = useTranslations("users.moderation");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "notification">("info");
  const [sendPush, setSendPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setSubject("");
    setMessage("");
    setType("info");
    setSendPush(true);
    setErr(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!subject.trim() || !message.trim() || userIds.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await sendBulkAdminMessage(token, {
        userIds,
        subject: subject.trim(),
        message: message.trim(),
        type,
        sendPush
      });
      onSuccess(result.count);
      handleClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("bulkMessageTitle", { count: userIds.length })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("bulkMessageLead")}</p>
        <div className="space-y-3">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subject")} />
          <select
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="info">{t("messageTypes.info")}</option>
            <option value="warning">{t("messageTypes.warning")}</option>
            <option value="notification">{t("messageTypes.notification")}</option>
          </select>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder={t("messageBody")} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
              className="size-4 rounded border accent-primary"
            />
            {t("sendPush")}
          </label>
          {userIds.length > 200 ? (
            <p className="text-xs text-destructive">{t("bulkMaxError")}</p>
          ) : null}
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={busy || !subject.trim() || !message.trim() || userIds.length === 0 || userIds.length > 200}
            onClick={() => void submit()}
          >
            {busy ? "…" : t("bulkSend", { count: userIds.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAccountDialog({
  open,
  onClose,
  token,
  userId,
  userName,
  onSuccess
}: Omit<BaseProps, "profileTypes">) {
  const t = useTranslations("users.moderation");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (confirm !== userName || !reason.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteUserAccount(token, userId, { reason, notifyUser: true });
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("deleteAccountTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl p-3">
          {t("deleteAccountWarning")}
        </p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input
          placeholder={userName}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy || confirm !== userName}
            onClick={() => void submit()}
          >
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
