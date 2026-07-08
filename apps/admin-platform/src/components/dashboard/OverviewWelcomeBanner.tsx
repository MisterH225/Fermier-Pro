"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Download, Filter } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Button } from "@/components/ui/button";
import { useAdminAccess } from "@/lib/admin-access-context";
import { useAdminToken } from "@/lib/useAdminToken";
import { fetchAdminMe } from "@/lib/admin-auth";

export function OverviewWelcomeBanner() {
  const t = useTranslations("overview");
  const { token } = useAdminToken();
  const { profile } = useAdminAccess();
  const [fullName, setFullName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchAdminMe(token).then((me) => {
      setFullName(me.fullName);
      setEmail(me.email);
    });
  }, [token]);

  const displayName =
    fullName?.trim() ||
    email?.split("@")[0] ||
    (profile?.role === "institution" ? profile.institutionLabel : null) ||
    "Admin";

  const roleLabel =
    profile?.role === "institution"
      ? profile.institutionLabel ?? t("welcome.roleInstitution")
      : t("welcome.roleSuperAdmin");

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary via-brand-light to-blue-400 px-5 py-6 sm:px-8 sm:py-7 text-white shadow-glow-blue">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
          backgroundSize: "32px 32px"
        }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-white/80">{t("welcome.badge")}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("welcome.greeting", { name: displayName })}
          </h1>
          <p className="max-w-xl text-sm text-white/85 sm:text-base">{t("welcome.lead")}</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="size-10 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25"
              asChild
            >
              <Link href="/statistiques" aria-label={t("actions.export")}>
                <Download className="size-4" />
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="size-10 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25"
              asChild
            >
              <Link href="/parametres" aria-label={t("actions.filter")}>
                <Filter className="size-4" />
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="size-10 rounded-full border-white/30 bg-white/15 text-white hover:bg-white/25"
              asChild
            >
              <Link href="/veterinaires" aria-label={t("welcome.notifications")}>
                <Bell className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-sm">
            <UserAvatar name={displayName} email={email} size="md" className="ring-2 ring-white/40" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-white/75">{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
