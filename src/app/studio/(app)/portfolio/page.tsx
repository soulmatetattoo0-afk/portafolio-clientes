import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { COLOR_MODES } from "@/lib/catalog";
import { env, live } from "@/lib/env";
import { listPortfolio } from "@/lib/queries";

import { PortfolioManager } from "./PortfolioManager";

export default async function PortfolioPage() {
  const member = await requireMember();
  const [{ t, locale }, items] = await Promise.all([getDict(), listPortfolio(member.artistId)]);
  const p = t.studio.portfolio;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{p.title}</h1>
      <p className="mt-1 mb-8 max-w-[60ch] text-ash">{p.lead}</p>
      <PortfolioManager
        items={items}
        locale={locale}
        storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null}
        labels={{
          upload: p.upload,
          uploadHint: p.uploadHint,
          empty: p.empty,
          style: p.style,
          color: p.color,
          healed: p.healed,
          published: p.published,
          delete: p.delete,
          deleteConfirm: p.deleteConfirm,
          cancel: t.common.cancel,
          blackGrey: COLOR_MODES[0].label[locale],
          colour: COLOR_MODES[1].label[locale],
          none: "—",
          error: t.brief.errors.upload,
        }}
      />
    </main>
  );
}
