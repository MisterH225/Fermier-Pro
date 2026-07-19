import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../globals.css";

/** Favicon / apple : même icône que l’appli mobile. */
const APP_ICON = "/images/fermier-pro-icon.png";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: APP_ICON, sizes: "1024x1024", type: "image/png" }
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: APP_ICON, sizes: "180x180", type: "image/png" }]
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
