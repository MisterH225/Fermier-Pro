"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { API_BASE } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const t = useTranslations("login");
  const app = useTranslations("app");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        setError(t("error"));
        return;
      }
      const meRes = await fetch(`${API_BASE}/admin/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });
      if (!meRes.ok) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand to-brand-light p-6">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <p className="text-3xl">🐷</p>
          <CardTitle className="text-xl">{app("title")}</CardTitle>
          <CardDescription>{t("title")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive bg-red-50 rounded-lg px-3 py-2">{error}</p>
            ) : null}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "…" : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
