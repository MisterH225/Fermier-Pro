"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createSanitaryAlert } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  accessToken: string;
  onCreated: () => void;
};

export function AlertCreationModal({ accessToken, onCreated }: Props) {
  const t = useTranslations("map.alertModal");
  const [open, setOpen] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "critical">("warning");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!zoneName.trim() || !message.trim()) return;
    setBusy(true);
    try {
      await createSanitaryAlert(accessToken, {
        zoneName: zoneName.trim(),
        alertType: "manual",
        level,
        message: message.trim()
      });
      setOpen(false);
      setZoneName("");
      setMessage("");
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t("create")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="zone">{t("zone")}</Label>
            <Input
              id="zone"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level">{t("level")}</Label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="info">{t("levels.info")}</option>
              <option value="warning">{t("levels.warning")}</option>
              <option value="critical">{t("levels.critical")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t("message")}</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={submit}>
              {busy ? "…" : t("submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
