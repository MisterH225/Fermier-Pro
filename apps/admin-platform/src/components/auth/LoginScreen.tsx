"use client";

import Image from "next/image";
import {
  ArrowRight,
  Baby,
  Brain,
  HeartPulse,
  Leaf,
  Mail,
  Map,
  Phone,
  PiggyBank,
  ShoppingCart,
  Sprout,
  Tractor,
  UtensilsCrossed,
  Wheat
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { verifyAdminSuperUser } from "@/lib/admin-auth";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAdminOAuthRedirectTo,
  setAdminOAuthNextCookie
} from "@/lib/admin-oauth";
import { cn } from "@/lib/utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2000&q=80";

const AMBITION_IMAGE =
  "https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1200&q=80";

const MODULE_KEYS = [
  "finance",
  "herd",
  "gestation",
  "feeding",
  "marketplace",
  "health",
  "sanitaryMap",
  "ai"
] as const;

const MODULE_IMAGES: Record<(typeof MODULE_KEYS)[number], string> = {
  finance:
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80",
  herd:
    "https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=800&q=80",
  gestation:
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80",
  feeding:
    "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80",
  marketplace:
    "https://images.unsplash.com/photo-1574943329822-f7931f8344f7?auto=format&fit=crop&w=800&q=80",
  health:
    "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80",
  sanitaryMap:
    "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80",
  ai:
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80"
};

const MODULE_ICONS: Record<(typeof MODULE_KEYS)[number], typeof Leaf> = {
  finance: PiggyBank,
  herd: Tractor,
  gestation: Baby,
  feeding: UtensilsCrossed,
  marketplace: ShoppingCart,
  health: HeartPulse,
  sanitaryMap: Map,
  ai: Brain
};

const MODULE_COLORS: Record<(typeof MODULE_KEYS)[number], string> = {
  finance: "from-emerald-500/20 to-emerald-600/5",
  herd: "from-primary/20 to-primary/5",
  gestation: "from-pink-500/20 to-pink-600/5",
  feeding: "from-amber-500/20 to-amber-600/5",
  marketplace: "from-indigo-500/20 to-indigo-600/5",
  health: "from-rose-500/20 to-rose-600/5",
  sanitaryMap: "from-sky-500/20 to-sky-600/5",
  ai: "from-violet-500/20 to-violet-600/5"
};

const STAT_KEYS = ["farms", "producers", "countries", "growth"] as const;

const STAT_STYLE: Record<
  (typeof STAT_KEYS)[number],
  { icon: typeof Leaf; bg: string; iconColor: string; valueColor: string }
> = {
  farms: {
    icon: Tractor,
    bg: "bg-primary/15",
    iconColor: "text-primary",
    valueColor: "text-primary"
  },
  producers: {
    icon: Sprout,
    bg: "bg-indigo-500/15",
    iconColor: "text-indigo-600",
    valueColor: "text-indigo-700"
  },
  countries: {
    icon: Wheat,
    bg: "bg-sky-500/15",
    iconColor: "text-sky-600",
    valueColor: "text-sky-700"
  },
  growth: {
    icon: Leaf,
    bg: "bg-amber-500/15",
    iconColor: "text-amber-600",
    valueColor: "text-amber-700"
  }
};

const NAV_KEYS = ["ambition", "modules", "contact"] as const;

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
            isLight ? "text-blue-200/90" : "text-primary/70"
          )}
        >
          SuperAdmin
        </span>
      ) : null}
    </div>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LoginScreen() {
  const t = useTranslations("login");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "oauth") {
      const reason = searchParams.get("reason");
      setError(reason ? t("oauthCallbackError", { reason }) : t("oauthRedirectError"));
    }
    if (searchParams.get("error") === "api") {
      setError(t("apiUnreachable"));
    }
  }, [searchParams, t]);

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
      if (!(await verifyAdminSuperUser(data.session.access_token))) {
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
    <div className="min-h-screen dashboard-bg">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/40 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => scrollToSection("top")} className="shrink-0">
            <LogoMark variant="dark" size="sm" />
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => scrollToSection(key)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
              >
                {t(`landing.nav.${key}`)}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => scrollToSection("login")}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary via-brand-light to-blue-400 px-5 py-2.5 text-sm font-bold text-white shadow-glow-blue transition hover:scale-[1.02]"
          >
            {t("navSignIn")}
            <ArrowRight className="size-4" />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-white/30 px-4 py-2 md:hidden">
          {NAV_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => scrollToSection(key)}
              className="shrink-0 rounded-full bg-white/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {t(`landing.nav.${key}`)}
            </button>
          ))}
        </nav>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/92 via-brand-light/80 to-indigo-900/88" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-20">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-blue-100">
              <Sprout className="size-3.5" />
              {t("hero.badge")}
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
              <span className="text-blue-200">{t("hero.titleHighlight")}</span>
              <br />
              {t("hero.titleRest")}
            </h1>

            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-white/90 sm:text-lg">
              {t("landing.heroLead")}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STAT_KEYS.map((key) => {
                const style = STAT_STYLE[key];
                const Icon = style.icon;
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/25 bg-white/10 px-3 py-4 text-center backdrop-blur-sm"
                  >
                    <span
                      className={cn(
                        "mx-auto mb-2 inline-flex size-9 items-center justify-center rounded-xl",
                        style.bg
                      )}
                    >
                      <Icon className={cn("size-4", style.iconColor)} strokeWidth={2.2} />
                    </span>
                    <p className="text-lg font-extrabold text-white">
                      {t(`hero.stats.${key}.value`)}
                    </p>
                    <p className="mt-1 text-[10px] font-medium leading-snug text-blue-100/90 sm:text-xs">
                      {t(`hero.stats.${key}.label`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Login card */}
          <div id="login" className="scroll-mt-24">
            <div className="glass-card rounded-3xl p-6 shadow-2xl sm:p-8">
              <div className="mb-6 text-center">
                <LogoMark variant="dark" size="md" centered />
                <h2 className="mt-4 text-2xl font-extrabold text-foreground">{t("title")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("formLead")}</p>
              </div>

              <button
                type="button"
                disabled={googleLoading}
                onClick={onGoogle}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/70 bg-white/50 px-6 py-3.5 text-sm font-bold text-foreground transition hover:bg-white/80 disabled:opacity-60"
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
                  <span className="w-full border-t border-dashed border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white/90 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("orEmail")}
                  </span>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-bold">
                    {t("email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 px-5 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-bold">
                    {t("password")}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 px-5 font-medium"
                  />
                </div>

                {error ? (
                  <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary via-brand-light to-blue-400 px-8 py-4 text-sm font-extrabold text-white shadow-glow-blue transition hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {loading ? "…" : t("submit")}
                  {!loading ? <ArrowRight className="size-5" /> : null}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">{t("googleHint")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ambition */}
      <section id="ambition" className="scroll-mt-24 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl">
            <Image
              src={AMBITION_IMAGE}
              alt={t("landing.ambition.imageAlt")}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/30 bg-white/15 p-4 backdrop-blur-md">
              <p className="text-sm font-bold text-white">{t("landing.ambition.imageCaption")}</p>
            </div>
          </div>

          <div>
            <span className="inline-flex rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              {t("landing.ambition.badge")}
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("landing.ambition.title")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("landing.ambition.lead")}
            </p>

            <ul className="mt-8 space-y-4">
              {(["actors", "traceability", "impact"] as const).map((point) => (
                <li key={point} className="flex gap-4 rounded-2xl border border-white/60 bg-white/50 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Leaf className="size-5" />
                  </span>
                  <div>
                    <p className="font-bold text-foreground">{t(`landing.ambition.points.${point}.title`)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(`landing.ambition.points.${point}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="scroll-mt-24 bg-white/40 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full bg-indigo-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700">
              {t("landing.modules.badge")}
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t("landing.modules.title")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("landing.modules.lead")}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_KEYS.map((key) => {
              const Icon = MODULE_ICONS[key];
              return (
                <article
                  key={key}
                  className="group overflow-hidden rounded-3xl border border-white/70 bg-white/70 shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={MODULE_IMAGES[key]}
                      alt={t(`landing.modules.items.${key}.title`)}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-t",
                        MODULE_COLORS[key]
                      )}
                    />
                    <span className="absolute left-4 top-4 inline-flex size-10 items-center justify-center rounded-xl bg-white/90 text-primary shadow">
                      <Icon className="size-5" strokeWidth={2.2} />
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-extrabold text-foreground">
                      {t(`landing.modules.items.${key}.title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`landing.modules.items.${key}.body`)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-24 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-brand-light to-indigo-600 shadow-2xl">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="text-white">
                <span className="inline-flex rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-100">
                  {t("landing.contact.badge")}
                </span>
                <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">{t("landing.contact.title")}</h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-100/95 sm:text-lg">
                  {t("landing.contact.lead")}
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href="mailto:info.e2ia@gmail.com"
                  className="flex items-center gap-4 rounded-2xl border border-white/25 bg-white/15 p-5 text-white backdrop-blur-sm transition hover:bg-white/25"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/20">
                    <Mail className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-100">Email</p>
                    <p className="font-bold">info.e2ia@gmail.com</p>
                  </div>
                </a>

                <a
                  href="tel:+2250757543447"
                  className="flex items-center gap-4 rounded-2xl border border-white/25 bg-white/15 p-5 text-white backdrop-blur-sm transition hover:bg-white/25"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/20">
                    <Phone className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-100">
                      {t("landing.contact.phone")}
                    </p>
                    <p className="font-bold">+225 07 57 54 34 47</p>
                  </div>
                </a>

                <a
                  href="tel:+2250708425141"
                  className="flex items-center gap-4 rounded-2xl border border-white/25 bg-white/15 p-5 text-white backdrop-blur-sm transition hover:bg-white/25"
                >
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/20">
                    <Phone className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-100">
                      {t("landing.contact.phoneAlt")}
                    </p>
                    <p className="font-bold">+225 07 08 42 51 41</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} E2IA — Fermier Pro</p>
          <p>{t("landing.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
