import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Cinzel, Cormorant_Garamond, Instrument_Serif, Pirata_One } from "next/font/google";
import localFont from "next/font/local";

import { getDict } from "@/i18n/server";
import { env } from "@/lib/env";

import "./globals.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600"] });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });
// The UI face ships with the app (variable, 400–600) so a build never waits on Google for it.
const instrument = localFont({ variable: "--font-instrument", src: "../fonts/instrument-sans.woff2", weight: "400 600", display: "swap" });
// Lettering for the sketchbook page: a flourished script.
const script = localFont({ variable: "--font-script", src: "../fonts/great-vibes.woff2", weight: "400", display: "swap" });
// The poster set for the public artist experience: a tall condensed display, a blackletter for numerals and kickers, a sharp italic for quotes.
const shoulders = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin"], axes: ["opsz"] });
const pirata = Pirata_One({ variable: "--font-pirata", subsets: ["latin"], weight: "400" });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: t.meta.title, template: "%s | Brief" },
    description: t.meta.description,
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
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
