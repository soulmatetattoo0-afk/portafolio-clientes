import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { getDict } from "@/i18n/server";
import { env } from "@/lib/env";

import "./globals.css";
import { Presence } from "@/components/Presence";

// Every face ships with the app (Google's woff2 files, OFL-licensed), so a build never waits on a font server.
const cinzel = localFont({ variable: "--font-cinzel", src: "../fonts/cinzel.woff2", weight: "400 900", display: "swap" });
const cormorant = localFont({
  variable: "--font-cormorant",
  src: [
    { path: "../fonts/cormorant.woff2", weight: "300 700", style: "normal" },
    { path: "../fonts/cormorant-italic.woff2", weight: "300 700", style: "italic" },
  ],
  display: "swap",
});
const instrument = localFont({ variable: "--font-instrument", src: "../fonts/instrument-sans.woff2", weight: "400 600", display: "swap" });
// The poster set for the public artist experience: a tall condensed display, a blackletter for numerals and kickers, a sharp italic for quotes.
const shoulders = localFont({ variable: "--font-shoulders", src: "../fonts/big-shoulders.woff2", weight: "100 900", display: "swap" });
const pirata = localFont({ variable: "--font-pirata", src: "../fonts/pirata-one.woff2", weight: "400", display: "swap" });
const instrumentSerif = localFont({
  variable: "--font-instrument-serif",
  src: [
    { path: "../fonts/instrument-serif.woff2", weight: "400", style: "normal" },
    { path: "../fonts/instrument-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  display: "swap",
});
// Lettering for the sketchbook page: a flourished script.
const script = localFont({ variable: "--font-script", src: "../fonts/great-vibes.woff2", weight: "400", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: t.meta.title, template: "%s | VANTA" },
    description: t.meta.description,
    icons: { icon: [{ url: "/icons/icon-192.png", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
    appleWebApp: { capable: true, title: "VANTA", statusBarStyle: "black-translucent" },
  };
}

// The embedded demo database boots and seeds on a cold start; give functions room for it.
export const maxDuration = 60;

export const viewport: Viewport = {
  themeColor: "#120f0c",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getDict();
  return (
    <html lang={locale} className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} ${shoulders.variable} ${pirata.variable} ${instrumentSerif.variable} ${script.variable}`}>
      <head>
        {/* The magazine's lettering: a shelf of faces the artist picks from. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Oswald:wght@600&family=Playfair+Display:wght@700&family=Abril+Fatface&family=Permanent+Marker&family=Special+Elite&family=UnifrakturMaguntia&family=Monoton&family=Righteous&family=Caveat:wght@700&family=Dancing+Script:wght@700&family=Rubik+Mono+One&display=swap"
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        {children}
        <Presence />
      </body>
    </html>
  );
}
