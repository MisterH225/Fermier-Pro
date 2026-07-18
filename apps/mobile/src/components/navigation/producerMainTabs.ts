import type { ProducerMainTab } from "./types";

export function producerMainTabs(financeEnabled: boolean): ProducerMainTab[] {
  return financeEnabled
    ? ["home", "cheptel", "health", "marketplace", "finance"]
    : ["home", "cheptel", "health", "marketplace"];
}
