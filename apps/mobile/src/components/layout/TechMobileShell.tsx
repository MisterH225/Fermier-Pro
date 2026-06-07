import type { ComponentProps } from "react";
import { techColors } from "../../theme/technicianTheme";
import { MobileAppShell } from "./MobileAppShell";

export function TechMobileShell(props: ComponentProps<typeof MobileAppShell>) {
  return <MobileAppShell canvasColor={techColors.canvas} {...props} />;
}
