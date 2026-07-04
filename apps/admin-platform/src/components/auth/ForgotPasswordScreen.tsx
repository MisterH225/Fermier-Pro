"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAdminPasswordRecoveryRedirectTo } from "@/lib/admin-oauth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 601 / 295;

export function ForgotPasswordScreen() {
  const t = useTranslations("forgotPassword");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: getAdminPasswordRecoveryRedirectTo(locale) }
      );
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setSent(true);
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

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-olive/10 text-brand-olive">
              <Mail className="size-7" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("sent")}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-olive hover:underline"
            >
              <ArrowLeft className="size-4" />
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-sm font-bold">
                {t("email")}
              </Label>
              <Input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

            <p className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-brand-olive"
              >
                <ArrowLeft className="size-4" />
                {t("backToLogin")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
