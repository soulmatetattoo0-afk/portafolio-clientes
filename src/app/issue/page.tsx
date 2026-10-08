import { redirect } from "next/navigation";

import { CURRENT_ISSUE } from "@/lib/issue/current";

/** /issue is the issue on the newsstand. */
export default function IssueIndex() {
  redirect(`/issue/${CURRENT_ISSUE}`);
}
