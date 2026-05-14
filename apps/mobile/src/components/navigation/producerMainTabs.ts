import type { ProducerMainTab } from "./types";

export function producerMainTabs(financeEnabled: boolean): ProducerMainTab[] {
  return financeEnabled
    ? ["home", "cheptel", "health", "finance"]
    : ["home", "cheptel", "health"];
}
