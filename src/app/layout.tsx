import type { Metadata, Viewport } from "next";
import { Anton, Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";

import { getDict } from "@/i18n/server";
import { env } from "@/lib/env";

import "./globals.css";

const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["500", "600"] });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], weight: ["400", "500", "600"] });
// Poster display face for the public artist experience (the giant word on the cover, panel titles).
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });

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
    <html lang={locale} className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} ${anton.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
