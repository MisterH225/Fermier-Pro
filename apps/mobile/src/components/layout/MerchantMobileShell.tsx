import type { ComponentProps } from "react";
import { merchantColors } from "../../theme/merchantTheme";
import { MobileAppShell } from "./MobileAppShell";

export function MerchantMobileShell(props: ComponentProps<typeof MobileAppShell>) {
  return <MobileAppShell canvasColor={merchantColors.canvas} {...props} />;
}
