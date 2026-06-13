import type { ComponentProps } from "react";
import { buyerColors } from "../../theme/buyerTheme";
import { MobileAppShell } from "./MobileAppShell";

export function BuyerMobileShell(props: ComponentProps<typeof MobileAppShell>) {
  return <MobileAppShell canvasColor={buyerColors.canvas} {...props} />;
}
