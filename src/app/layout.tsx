import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Cinzel, Cormorant_Garamond, Instrument_Sans, Instrument_Serif, Pirata_One } from "next/font/google";

import { getDict } from "@/i18n/server";
import { env } from "@/lib/env";

import "./globals.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600"] });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], weight: ["400", "500", "600"] });
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

export const viewport: Viewport = {
  themeColor: "#120f0c",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getDict();
  return (
    <html lang={locale} className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} ${shoulders.variable} ${pirata.variable} ${instrumentSerif.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
