import { PushPrompt } from "@/components/PushPrompt";
import type { Dict } from "@/i18n";
import { vapidKeys } from "@/lib/push";

/** Requests and messages reach the artist's phone with the app closed: asked for on the profile and the inbox only. */
export function StudioPush({ t, className = "mb-6" }: { t: Dict; className?: string }) {
  return <PushPrompt vapidKey={vapidKeys().publicKey} className={className} labels={{ title: t.push.title, body: t.push.bodyArtist, enable: t.push.enable, on: t.push.on, denied: t.push.denied, ios: t.push.ios }} />;
}
