"use client";

import Image from "next/image";
import { ArrowRight, Leaf, Sprout, Sparkles, Tractor, Wheat } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { API_BASE } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_OAUTH_NEXT_COOKIE,
  getAdminOAuthRedirectAllowListEntry,
  getAdminOAuthRedirectTo,
  getAdminOAuthRedirectWildcardEntry,
  setAdminOAuthNextCookie
} from "@/lib/admin-oauth";
import { cn } from "@/lib/utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2000&q=80";

const STAT_KEYS = ["farms", "producers", "countries", "growth"] as const;

const STAT_STYLE: Record<
  (typeof STAT_KEYS)[number],
  { icon: typeof Leaf; bg: string; iconColor: string; valueColor: string }
> = {
  farms: {
    icon: Tractor,
    bg: "bg-brand/10",
    iconColor: "text-brand",
    valueColor: "text-brand"
  },
  producers: {
    icon: Sprout,
    bg: "bg-brand-olive/15",
    iconColor: "text-brand-olive",
    valueColor: "text-brand-olive-dark"
  },
  countries: {
    icon: Wheat,
    bg: "bg-brand-accent/15",
    iconColor: "text-brand-accent",
    valueColor: "text-brand-accent"
  },
  growth: {
    icon: Leaf,
    bg: "bg-brand-gold/20",
    iconColor: "text-amber-700",
    valueColor: "text-amber-800"
  }
};

const TAG_STYLE = [
  "bg-brand/10 text-brand border-brand/20",
  "bg-brand-olive/15 text-brand-olive-dark border-brand-olive/25",
  "bg-brand-accent/10 text-orange-800 border-brand-accent/30"
] as const;

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 601 / 295;

function LogoMark({
  className,
  variant = "light",
  size = "md",
  centered = false
}: {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  centered?: boolean;
}) {
  const widths = { sm: 140, md: 168, lg: 220 };
  const w = widths[size];
  const h = Math.round(w / LOGO_ASPECT);
  const isLight = variant === "light";

  return (
    <div className={cn("flex flex-col gap-2", centered && "items-center", className)}>
      <Image
        src={LOGO_SRC}
        alt="Fermier Pro"
        width={w}
        height={h}
        priority
        className={cn(
          "object-contain",
          centered ? "object-center" : "object-left",
          isLight && "drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
        )}
      />
      {size !== "sm" ? (
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.25em]",
            centered && "text-center",
            isLight ? "text-brand-gold/90" : "text-brand-olive"
          )}
        >
          SuperAdmin
        </span>
      ) : null}
    </div>
  );
}

export function LoginScreen() {
  const t = useTranslations("login");
  const app = useTranslations("app");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [redirectHint, setRedirectHint] = useState("");
  const [redirectWildcard, setRedirectWildcard] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    setRedirectHint(getAdminOAuthRedirectAllowListEntry());
    setRedirectWildcard(getAdminOAuthRedirectWildcardEntry());
  }, []);

  useEffect(() => {
    if (searchParams.get("error") === "oauth") {
      const reason = searchParams.get("reason");
      setError(reason ? t("oauthCallbackError", { reason }) : t("oauthRedirectError"));
    }
    if (searchParams.get("error") === "api") {
      setError(t("apiUnreachable"));
    }
  }, [searchParams, t]);

  const verifySuperAdmin = async (accessToken: string) => {
    const meRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return meRes.ok;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (signErr || !data.session?.access_token) {
        setError(t("errorGoogleHint"));
        return;
      }
      if (!(await verifySuperAdmin(data.session.access_token))) {
        await supabase.auth.signOut();
        setError(t("forbidden"));
        return;
      }
      router.replace("/");
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      setAdminOAuthNextCookie(locale);
      const redirectTo = getAdminOAuthRedirectTo();
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });
      if (oauthErr) {
        setError(oauthErr.message);
        return;
      }
      const oauthUrl = data?.url?.trim();
      if (!oauthUrl?.startsWith("https://")) {
        setError(t("oauthNoUrl"));
        return;
      }
      window.location.href = oauthUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("NEXT_PUBLIC_SUPABASE")) {
        setError(t("oauthEnvMissing"));
      } else {
        setError(t("oauthNoUrl"));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-brand-cream">
      {/* Hero */}
      <div className="relative lg:w-[58%] min-h-[360px] lg:min-h-screen flex flex-col overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand/90 via-brand-light/75 to-brand-olive-dark/85" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, #FF8C00 0%, transparent 40%),
              radial-gradient(circle at 80% 20%, #8B9A5B 0%, transparent 35%)`
          }}
        />

        {/* Formes décoratives */}
        <div className="absolute -top-24 -right-24 size-64 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="absolute bottom-32 -left-16 size-48 rounded-full bg-brand-olive-light/30 blur-2xl" />

        <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-10">
          <LogoMark variant="light" size="md" />
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-1.5 py-1.5 border border-white/25 shadow-lg">
            <span className="rounded-full bg-brand-accent text-white text-xs font-bold px-4 py-2 shadow-md">
              {t("navSignIn")}
            </span>
            <span className="text-white/90 text-xs font-medium px-4 py-2 hover:text-brand-gold transition">
              {t("navAbout")}
            </span>
          </nav>
        </header>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-6 lg:px-12 text-center text-white">
          <Sparkles className="absolute top-[26%] left-[14%] size-5 text-brand-gold hidden lg:block animate-pulse" />
          <Sparkles className="absolute top-[20%] right-[18%] size-4 text-brand-olive-light hidden lg:block" />
          <Leaf className="absolute bottom-[42%] right-[10%] size-8 text-brand-olive-light/40 rotate-12 hidden lg:block" />

          <span className="inline-flex items-center gap-2 rounded-full border-2 border-brand-accent/50 bg-brand-accent/20 backdrop-blur-sm px-5 py-2 text-xs font-bold uppercase tracking-wide text-brand-gold mb-6 shadow-lg">
            <Sprout className="size-3.5 text-brand-gold" />
            {t("hero.badge")}
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-extrabold leading-[1.08] tracking-tight max-w-xl drop-shadow-lg">
            <span className="text-brand-gold">{t("hero.titleHighlight")}</span>
            <br />
            <span className="text-white">{t("hero.titleRest")}</span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-white/90 max-w-md leading-relaxed font-medium">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Stats colorées */}
        <div className="relative z-10 mx-4 mb-5 lg:mx-8 lg:mb-8 rounded-3xl bg-white/95 backdrop-blur-sm shadow-2xl shadow-brand/20 border-2 border-white overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-brand via-brand-olive to-brand-accent" />
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {STAT_KEYS.map((key) => {
              const style = STAT_STYLE[key];
              const Icon = style.icon;
              return (
                <div
                  key={key}
                  className="px-3 py-5 lg:py-6 text-center border-r border-b lg:border-b-0 border-brand-cream last:border-r-0 [&:nth-child(2)]:lg:border-r"
                >
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-2xl mb-2",
                      style.bg
                    )}
                  >
                    <Icon className={cn("size-5", style.iconColor)} strokeWidth={2.2} />
                  </span>
                  <p className={cn("text-xl lg:text-2xl font-extrabold tracking-tight", style.valueColor)}>
                    {t(`hero.stats.${key}.value`)}
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-brand-olive font-medium leading-snug px-1">
                    {t(`hero.stats.${key}.label`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cream via-white to-brand-cream" />
        <div
          className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #8B9A5B 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-56 h-56 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #FF8C00 0%, transparent 70%)" }}
        />

        <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-12">
          <LogoMark variant="dark" size="sm" className="lg:hidden" />
          <p className="hidden lg:flex items-center gap-2 text-sm font-semibold text-brand ml-auto">
            <span className="size-2 rounded-full bg-brand-accent animate-pulse" />
            {app("subtitle")}
          </p>
        </header>

        <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="hidden lg:flex justify-center mb-8">
              <LogoMark variant="dark" size="lg" centered />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/20 px-4 py-1.5 mb-4">
              <span className="text-xs font-bold text-brand tracking-widest">{t("formYear")}</span>
              <span className="size-1 rounded-full bg-brand-accent" />
              <span className="text-xs font-semibold text-brand-olive">{t("formTag")}</span>
            </div>

            <h2 className="text-2xl sm:text-[2rem] font-extrabold text-brand tracking-tight leading-tight">
              {t("title")}
            </h2>
            <p className="mt-2 text-sm text-brand-olive font-medium">{t("formLead")}</p>

            <div className="mt-8 p-6 rounded-3xl bg-white border-2 border-brand/10 shadow-xl shadow-brand/5">
              <button
                type="button"
                disabled={googleLoading}
                onClick={onGoogle}
                className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-brand/20 bg-brand-cream px-6 py-3.5 text-sm font-bold text-brand transition hover:border-brand hover:bg-brand/5 disabled:opacity-60"
              >
                <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {googleLoading ? "…" : t("google")}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t-2 border-dashed border-brand/15" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-xs font-bold uppercase tracking-wider text-brand-olive">
                    {t("orEmail")}
                  </span>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-brand font-bold text-sm">
                    {t("email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl border-2 border-brand/15 bg-brand-cream/50 px-5 font-medium text-brand placeholder:text-brand-olive/50 focus-visible:ring-brand-accent focus-visible:border-brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-brand font-bold text-sm">
                    {t("password")}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-2xl border-2 border-brand/15 bg-brand-cream/50 px-5 font-medium text-brand focus-visible:ring-brand-accent focus-visible:border-brand"
                  />
                </div>

                {error ? (
                  <p className="text-sm font-medium text-red-700 bg-red-50 rounded-2xl px-4 py-3 border-2 border-red-200">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand via-brand-light to-brand-olive text-white px-8 py-4 text-sm font-extrabold shadow-lg shadow-brand/30 transition hover:shadow-xl hover:shadow-brand/40 hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {loading ? "…" : t("submit")}
                  {!loading ? <ArrowRight className="size-5" /> : null}
                </button>
              </form>
            </div>

            <p className="mt-5 text-xs text-brand-olive/80 leading-relaxed px-1">{t("googleHint")}</p>

            {redirectHint ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-brand-accent/40 bg-brand-accent/5 p-4 text-xs">
                <p className="font-bold text-brand mb-1">{t("oauthSetupTitle")}</p>
                <p className="text-brand-olive mb-2">{t("oauthSetupBody")}</p>
                <code className="block break-all rounded-lg bg-white px-2 py-2 text-[11px] text-brand border border-brand/15">
                  {redirectHint}
                </code>
                <p className="mt-2 text-brand-olive/80">{t("oauthSetupWildcard")}</p>
                <code className="mt-1 block break-all rounded-lg bg-white px-2 py-2 text-[11px] text-brand border border-brand/15">
                  {redirectWildcard}
                </code>
                <p className="mt-2 text-brand-olive/90">{t("oauthSetupWrong")}</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-2">
              {(["organic", "automation", "health"] as const).map((tag, i) => (
                <span
                  key={tag}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-bold",
                    TAG_STYLE[i]
                  )}
                >
                  {t(`hero.tags.${tag}`)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
