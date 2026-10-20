import { DemoBanner } from "@/components/Chrome";
import { WorldBar } from "@/components/world/WorldBar";
import { BRAND } from "@/lib/brand";

/** Account pages shared by clients and artists: the password, and getting back in. */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="poster relative flex min-h-dvh flex-col" style={{ ["--accent" as string]: BRAND.accent }}>
      <div className="p-grain" aria-hidden />
      <DemoBanner />
      <WorldBar />
      <main className="relative mx-auto grid w-full max-w-md flex-1 content-start gap-8 px-4 pt-6 pb-24">{children}</main>
    </div>
  );
}
