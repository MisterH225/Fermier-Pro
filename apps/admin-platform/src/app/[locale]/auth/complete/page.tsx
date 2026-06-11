"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { verifyAdminSuperUser } from "@/lib/admin-auth";
import { useRouter } from "@/i18n/navigation";

export default function AuthCompletePage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [message, setMessage] = useState("…");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setMessage(t("error"));
          router.replace("/login");
          return;
        }
        if (!(await verifyAdminSuperUser(token))) {
          await supabase.auth.signOut();
          setMessage(t("forbidden"));
          router.replace("/login");
          return;
        }
        router.replace("/");
      } catch {
        setMessage(t("apiUnreachable"));
        router.replace("/login?error=api");
      }
    };
    void run();
  }, [router, t]);

  return (
    <div className="min-h-screen dashboard-bg flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p>{message}</p>
    </div>
  );
}
