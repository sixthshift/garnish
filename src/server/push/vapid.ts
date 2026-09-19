import webpush from "web-push";
import pushRepo, { type PushRepository, type VapidKeys } from "../../db/models/push/repo";

/**
 * Who the push service may contact about this sender, as RFC 8292 wants: a
 * `mailto:` or an `https:` URL. `PUSH_CONTACT` overrides it; the default
 * names the project, which is true of every instance.
 */
export function vapidSubject(env: Record<string, string | undefined> = process.env): string {
  const contact = env.PUSH_CONTACT?.trim();
  return contact && contact.length > 0 ? contact : "https://github.com/sixthshift/garnish";
}

/**
 * The server's key pair: the stored one, or a fresh one made and stored on
 * the first call. Never regenerated, because every phone's subscription is
 * bound to the public key it was made with.
 */
export function vapidKeys(repo: PushRepository = pushRepo, generate: () => VapidKeys = webpush.generateVAPIDKeys): VapidKeys {
  return repo.vapid() ?? repo.setVapid(generate());
}
