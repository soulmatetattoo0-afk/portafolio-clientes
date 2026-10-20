/** While an artist's page loads: the dark room and a pulse, so a tap always answers at once. */
export default function Loading() {
  return (
    <div className="poster grid min-h-dvh place-items-center" aria-busy="true">
      <span className="h-3 w-3 animate-ping rounded-full bg-bone/70" />
    </div>
  );
}
