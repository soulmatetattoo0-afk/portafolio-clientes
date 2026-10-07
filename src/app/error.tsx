"use client";

import { useEffect } from "react";

/** Last-resort screen. Copy is bilingual because the dictionary may be what failed. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-center gap-5 px-4 py-20 sm:px-6">
      <h1 className="t-title">Something failed on our side. Try again in a moment.</h1>
      <p className="font-serif text-[1.3rem] text-ash italic" lang="es">
        Algo falló de nuestro lado. Inténtalo de nuevo en un momento.
      </p>
      <button type="button" className="btn btn-primary w-fit" onClick={reset}>
        Try again / Intentar de nuevo
      </button>
      {error.digest && <p className="t-meta t-num">{error.digest}</p>}
    </main>
  );
}
