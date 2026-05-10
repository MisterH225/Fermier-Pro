import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { farmDetailMenuVisibility } from "../../lib/menuVisibility";
import type { RootStackParamList } from "../../types/navigation";

/** Flags `/config/client` pour la liste fermes (pas de scope ferme active). */
export type FarmListFeatureFlags = ReturnType<typeof farmDetailMenuVisibility>;

export type FarmListHeaderSecondaryItem = {
  id: "messages" | "marketplace";
  label: string;
  visible: boolean;
  screen: "ChatRooms" | "MarketplaceList";
};

export type FarmListListHeaderRow =
  | {
      kind: "marketplaceBanner";
      visible: boolean;
      title: string;
      subtitle: string;
      target: { screen: "MarketplaceList" };
    }
  | {
      kind: "createFarm";
      visible: boolean;
      title: string;
      target: { screen: "CreateFarm" };
    }
  | {
      kind: "invite";
      visible: true;
      title: string;
      target: { screen: "AcceptFarmInvitation"; params: {} };
    };

export type FarmListEmptyRow =
  | {
      kind: "marketplaceCta";
      visible: boolean;
      title: string;
      target: { screen: "MarketplaceList" };
    }
  | {
      kind: "createFarmCta";
      visible: boolean;
      title: string;
      target: { screen: "CreateFarm" };
    }
  | {
      kind: "invite";
      visible: true;
      title: string;
      target: { screen: "AcceptFarmInvitation"; params: {} };
    };

export type FarmListQuickNav =
  | { screen: "ChatRooms" }
  | { screen: "MarketplaceList" }
  | { screen: "CreateFarm" }
  | { screen: "AcceptFarmInvitation"; params: { prefilledToken?: string } };

export function buildFarmListHeaderSecondaryItems(
  menu: FarmListFeatureFlags
): FarmListHeaderSecondaryItem[] {
  return [
    {
      id: "messages",
      label: "Messages",
      visible: menu.chat,
      screen: "ChatRooms"
    },
    {
      id: "marketplace",
      label: "Marché",
      visible: menu.marketplace,
      screen: "MarketplaceList"
    }
  ];
}

export function buildFarmListListHeaderRows(args: {
  menu: FarmListFeatureFlags;
  hasProducerProfile: boolean;
}): FarmListListHeaderRow[] {
  const { menu, hasProducerProfile } = args;
  return [
    {
      kind: "marketplaceBanner",
      visible: menu.marketplace,
      title: "Voir le marché",
      subtitle: "Annonces publiées · achat / inspiration",
      target: { screen: "MarketplaceList" }
    },
    {
      kind: "createFarm",
      visible: hasProducerProfile,
      title: "+ Nouvelle ferme",
      target: { screen: "CreateFarm" }
    },
    {
      kind: "invite",
      visible: true,
      title: "J'ai un code d'invitation",
      target: { screen: "AcceptFarmInvitation", params: {} }
    }
  ];
}

export function buildFarmListEmptyRows(args: {
  menu: FarmListFeatureFlags;
  hasProducerProfile: boolean;
}): FarmListEmptyRow[] {
  const { menu, hasProducerProfile } = args;
  return [
    {
      kind: "marketplaceCta",
      visible: menu.marketplace,
      title: "Voir le marché",
      target: { screen: "MarketplaceList" }
    },
    {
      kind: "createFarmCta",
      visible: hasProducerProfile,
      title: "Créer une ferme",
      target: { screen: "CreateFarm" }
    },
    {
      kind: "invite",
      visible: true,
      title: "J'ai un code d'invitation",
      target: { screen: "AcceptFarmInvitation", params: {} }
    }
  ];
}

export function navigateFarmListQuickNav(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  nav: FarmListQuickNav
): void {
  switch (nav.screen) {
    case "ChatRooms":
      navigation.navigate("ChatRooms");
      return;
    case "MarketplaceList":
      navigation.navigate("MarketplaceList");
      return;
    case "CreateFarm":
      navigation.navigate("CreateFarm");
      return;
    case "AcceptFarmInvitation":
      navigation.navigate("AcceptFarmInvitation", nav.params);
      return;
  }
}
