// Service worker entry. Bundled by src/sw/plugin.ts into public/sw.js at build
// time with `__SW_CONFIG__` replaced by the real shell URL, asset list and
// build hash. Not part of the app bundle; never imported from src/.
import { installServiceWorker, type ServiceWorkerScopeLike, type SwConfig } from "./worker";

declare const __SW_CONFIG__: SwConfig;

installServiceWorker(self as unknown as ServiceWorkerScopeLike, __SW_CONFIG__);
