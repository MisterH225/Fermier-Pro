import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";

/** Favicon / apple icon : même marque que l’appli mobile (carré 1024). */
const LOGO_ICON = "/images/fermier-pro-icon.png";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: LOGO_ICON, type: "image/png" }],
    shortcut: LOGO_ICON,
    apple: LOGO_ICON
  }
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
