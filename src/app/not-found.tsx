import Link from "next/link";

import { PublicBar } from "@/components/Chrome";
import { getDict } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getDict();
  return (
    <>
      <PublicBar />
      <main className="mx-auto grid w-full max-w-xl flex-1 content-center gap-6 px-4 py-20 sm:px-6">
        <p className="t-inscription text-[4rem] text-gilt/70">404</p>
        <h1 className="t-title">{t.common.notFound}</h1>
        <Link href="/" className="btn btn-secondary w-fit">
          {t.common.goHome}
        </Link>
      </main>
    </>
  );
}
