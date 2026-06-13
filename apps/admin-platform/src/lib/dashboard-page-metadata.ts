import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function dashboardPageMetadata(
  namespace: string,
  titleKey = "title"
): Promise<Metadata> {
  const [page, app] = await Promise.all([
    getTranslations(namespace),
    getTranslations("app")
  ]);
  return {
    title: `${page(titleKey)} · ${app("title")}`
  };
}
