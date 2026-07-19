"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 1200 / 848;
const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordScreen() {
  const t = useTranslations("resetPassword");
  const tPassword = useTranslations("settings.password");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        setSessionOk(Boolean(data.session?.access_token));
      } catch {
        setSessionOk(false);
      } finally {
        setChecking(false);
      }
    };
    void run();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(tPassword("tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(tPassword("mismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      await supabase.auth.signOut();
      router.replace("/login?reset=success");
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center farm-landing-bg px-4 py-12">
      <div className="farm-card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <Image
            src={LOGO_SRC}
            alt="Fermier Pro"
            width={140}
            height={Math.round(140 / LOGO_ASPECT)}
            className="mx-auto object-contain"
            priority
          />
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("lead")}</p>
        </div>

        {checking ? (
          <p className="text-center text-sm text-muted-foreground">…</p>
        ) : !sessionOk ? (
          <div className="space-y-4 text-center">
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {t("expired")}
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-olive hover:underline"
            >
              {t("requestNewLink")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-bold">
                {tPassword("new")}
              </Label>
              <Input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tPassword("placeholder")}
                className="h-12 rounded-2xl border-gray-200 px-5 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-bold">
                {tPassword("confirm")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 rounded-2xl border-gray-200 px-5 font-medium"
              />
            </div>

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className="farm-btn w-full disabled:opacity-60">
              {loading ? "…" : t("submit")}
              {!loading ? <ArrowRight className="size-5" /> : null}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
