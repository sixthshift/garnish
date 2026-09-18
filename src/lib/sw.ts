import type { ToastOptions } from "@sixthshift/design-system/overlay";
import { SKIP_WAITING } from "../sw/message";

/** The slice of a `ServiceWorker` the page talks to. */
export type ServiceWorkerLike = {
  state?: string;
  postMessage: (message: unknown) => void;
  addEventListener: (type: "statechange", listener: () => void) => void;
};

/** The slice of a `ServiceWorkerRegistration` the update watch reads. */
export type RegistrationLike = {
  /** A worker installed and waiting behind the one running this page. */
  waiting?: ServiceWorkerLike | null;
  /** The worker currently downloading, during `updatefound`. */
  installing?: ServiceWorkerLike | null;
  addEventListener: (type: "updatefound", listener: () => void) => void;
};

/** The slice of `navigator.serviceWorker`. Everything but `register` is absent in the older fakes tests pass. */
export type ServiceWorkerContainerLike = {
  register: (url: string, options?: { scope?: string }) => Promise<unknown>;
  /** The worker controlling this page, or null on the very first load. */
  controller?: ServiceWorkerLike | null;
  addEventListener?: (type: "controllerchange", listener: () => void) => void;
};

/** The slice of `navigator` used. `serviceWorker` is absent in unsupported or insecure contexts. */
export type ServiceWorkerNavigatorLike = {
  serviceWorker?: ServiceWorkerContainerLike;
};

export const SW_URL = "/sw.js";

/** What `registerServiceWorker` does beyond registering. */
export type RegisterOptions = {
  /** Told when a new version has installed and is waiting for the page's word. */
  onUpdateReady?: (waiting: ServiceWorkerLike) => void;
  /** How the page reloads once the new worker takes over. Defaults to `location.reload()`. */
  reload?: () => void;
};

/** A registration object, or nothing when `register` resolved to something else. Pure. */
function asRegistration(value: unknown): RegistrationLike | null {
  return typeof value === "object" && value !== null && typeof (value as RegistrationLike).addEventListener === "function" ? (value as RegistrationLike) : null;
}

/**
 * Call `onReady` once, with the worker that has installed behind the one
 * running this page. `hasController` tells an update from a first install: an
 * `installed` worker with nothing to replace is simply the first one, and has
 * no news for anybody. Never throws.
 */
export function watchForUpdate(registration: RegistrationLike, hasController: () => boolean, onReady: (waiting: ServiceWorkerLike) => void): void {
  let told = false;
  const ready = (worker: ServiceWorkerLike) => {
    if (told) return;
    told = true;
    onReady(worker);
  };

  // Installed while this page was elsewhere, or before it loaded: `waiting`
  // only exists when another worker is active, so this is always an update.
  if (registration.waiting) ready(registration.waiting);

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && hasController()) ready(installing);
    });
  });
}

/** Tell the waiting worker to take over. The reload follows from `controllerchange`. */
export function applyUpdate(waiting: ServiceWorkerLike): void {
  waiting.postMessage(SKIP_WAITING);
}

/**
 * Reload the page the first time the controlling worker changes, so every
 * open tab lands on the new build's assets. Only ever fires after an
 * `applyUpdate` here or in another tab. Never throws.
 */
export function reloadOnControllerChange(container: ServiceWorkerContainerLike, reload: () => void): void {
  let reloaded = false;
  container.addEventListener?.("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  });
}

/** The notice offering the update. Pure: `onSelect` is the only thing that acts. */
export function updateNotice(waiting: ServiceWorkerLike): ToastOptions {
  return {
    intent: "neutral",
    title: "A new version is ready",
    children: "Reload to pick it up. Anything unsaved stays as it is until you do.",
    // Sticky: this one waits for an answer rather than sliding past mid-cook.
    duration: 0,
    action: "Reload",
    onAction: () => applyUpdate(waiting),
  };
}

/** The page's default reload, guarded for the server where there is no location. */
function reloadPage(): void {
  if (typeof location !== "undefined") location.reload();
}

/**
 * Register `/sw.js` at scope `/` when `production` and the API exists, and
 * watch that registration for a new version (`options.onUpdateReady`).
 * Returns whether a registration was attempted. Never throws or rejects.
 */
export function registerServiceWorker(navigatorLike: ServiceWorkerNavigatorLike | undefined, production: boolean, options: RegisterOptions = {}): boolean {
  const api = navigatorLike?.serviceWorker;
  // In dev there is no /sw.js, and a stale worker would hide Vite's live updates.
  if (!production || !api) return false;
  try {
    void Promise.resolve(api.register(SW_URL, { scope: "/" }))
      .then((value) => {
        const registration = asRegistration(value);
        if (!registration || options.onUpdateReady === undefined) return;
        watchForUpdate(registration, () => api.controller != null, options.onUpdateReady);
        reloadOnControllerChange(api, options.reload ?? reloadPage);
      })
      .catch(() => {});
  } catch {
    return false;
  }
  return true;
}
