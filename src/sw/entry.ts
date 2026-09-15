import { installServiceWorker, type ServiceWorkerScopeLike, type SwConfig } from "./worker";

declare const __SW_CONFIG__: SwConfig;

installServiceWorker(self as unknown as ServiceWorkerScopeLike, __SW_CONFIG__);
