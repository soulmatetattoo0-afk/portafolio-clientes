import { notFound } from "next/navigation";

import { Bench } from "./Bench";

export const metadata = { robots: { index: false } };

/** The mannequin on a bench, for looking at every pose and camera while developing. Never in production. */
export default function MannequinLab() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Bench />;
}
