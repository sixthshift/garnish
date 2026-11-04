import { planFill } from "./fill";
import { plan } from "./plan";
import { planIndex } from "./planIndex";

/** The plan's addresses: the week, and filling one. */
export const planRoutes = plan.addChildren([planIndex, planFill]);
