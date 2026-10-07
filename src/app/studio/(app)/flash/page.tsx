import { getDict } from "@/i18n/server";
import { requireMember } from "@/lib/auth";
import { env, live } from "@/lib/env";
import { listFlash } from "@/lib/queries";

import { FlashManager } from "./FlashManager";

export default async function FlashPage() {
  const member = await requireMember();
  const [{ t, locale }, items] = await Promise.all([getDict(), listFlash(member.artistId)]);
  const f = t.studio.flash;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="t-title">{f.title}</h1>
      <p className="mt-1 mb-8 max-w-[60ch] text-ash">{f.lead}</p>
      <FlashManager
        items={items}
        locale={locale}
        storage={live.storage ? { url: env.supabaseUrl!, anonKey: env.supabaseAnonKey! } : null}
        labels={{
          upload: f.upload,
          uploadHint: f.uploadHint,
          empty: f.empty,
          name: f.name,
          description: f.description,
          size: f.size,
          sizeHint: f.sizeHint,
          price: f.price,
          status: f.status,
          statuses: f.statuses,
          repeatable: f.repeatable,
          published: f.published,
          delete: f.delete,
          deleteConfirm: f.deleteConfirm,
          cancel: t.common.cancel,
          save: t.common.save,
          saved: t.common.saved,
          error: t.brief.errors.upload,
        }}
      />
    </main>
  );
}
