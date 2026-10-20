import { Loading } from "@/v2/Loading";

/** While an artist's page loads: its shape in soft blocks, so a tap always answers at once. */
export default function Load() {
  return <Loading kind="page" />;
}
