import { CommonActions } from "@react-navigation/native";
import { dashboardRouteForActiveProfileType } from "./dashboardHomeRoute";
import { rootNavigationRef } from "./navigationRef";

/** Remet la pile de navigation sur l’écran d’accueil du profil actif. */
export function resetNavigationToProfileHome(
  profileType: string | undefined
): void {
  if (!rootNavigationRef.isReady()) {
    return;
  }
  const routeName = dashboardRouteForActiveProfileType(profileType);
  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: routeName }]
    })
  );
}
