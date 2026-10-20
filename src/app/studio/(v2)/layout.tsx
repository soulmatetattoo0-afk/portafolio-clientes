import { getDict } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.studio.nav.label, robots: { index: false } };
}

/** The artist's app: each screen brings its own bar; the layout only sets the theme. */
export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return <div className="poster studio flex min-h-dvh flex-col">{children}</div>;
}
