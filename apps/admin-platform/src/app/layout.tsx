import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Favicon racine (requêtes `/favicon.ico`) — même marque que l’appli. */
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/fermier-pro-icon.png", sizes: "1024x1024", type: "image/png" }
    ],
    apple: "/images/fermier-pro-icon.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
