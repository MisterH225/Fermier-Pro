import type { ComponentProps } from "react";
import { vetColors } from "../../theme/vetTheme";
import { MobileAppShell } from "./MobileAppShell";

/** Shell mobile avec fond canvas bleu médical (module vétérinaire). */
export function VetMobileShell(props: ComponentProps<typeof MobileAppShell>) {
  return <MobileAppShell canvasColor={vetColors.canvas} {...props} />;
}
