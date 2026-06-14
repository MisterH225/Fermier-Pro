import type { TFunction } from "i18next";
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
      target: {
        screen: "MarketplaceList";
        tab?: "offers";
        offersSubTab?: "received" | "sent";
      };
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
      target: {
        screen: "MarketplaceList";
        tab?: "offers";
        offersSubTab?: "received" | "sent";
      };
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
  | {
      screen: "MarketplaceList";
      tab?: "offers";
      offersSubTab?: "received" | "sent";
    }
  | { screen: "CreateFarm" }
  | { screen: "AcceptFarmInvitation"; params: { prefilledToken?: string } };

export function buildFarmListHeaderSecondaryItems(
  menu: FarmListFeatureFlags,
  t: TFunction
): FarmListHeaderSecondaryItem[] {
  return [
    {
      id: "messages",
      label: t("farmListScreen.headerMessages"),
      visible: menu.chat,
      screen: "ChatRooms"
    },
    {
      id: "marketplace",
      label: t("farmListScreen.headerMarket"),
      visible: menu.marketplace,
      screen: "MarketplaceList"
    }
  ];
}

export function buildFarmListListHeaderRows(
  args: {
    menu: FarmListFeatureFlags;
    hasProducerProfile: boolean;
  },
  t: TFunction
): FarmListListHeaderRow[] {
  const { menu, hasProducerProfile } = args;
  return [
    {
      kind: "marketplaceBanner",
      visible: menu.marketplace,
      title: t("farmListScreen.marketBannerTitle"),
      subtitle: t("farmListScreen.marketBannerSub"),
      target: {
        screen: "MarketplaceList",
        tab: "offers",
        offersSubTab: "received"
      }
    },
    {
      kind: "createFarm",
      visible: hasProducerProfile,
      title: t("farmListScreen.newFarm"),
      target: { screen: "CreateFarm" }
    },
    {
      kind: "invite",
      visible: true,
      title: t("farmListScreen.inviteCode"),
      target: { screen: "AcceptFarmInvitation", params: {} }
    }
  ];
}

export function buildFarmListEmptyRows(
  args: {
    menu: FarmListFeatureFlags;
    hasProducerProfile: boolean;
  },
  t: TFunction
): FarmListEmptyRow[] {
  const { menu, hasProducerProfile } = args;
  return [
    {
      kind: "marketplaceCta",
      visible: menu.marketplace,
      title: t("farmListScreen.marketBannerTitle"),
      target: {
        screen: "MarketplaceList",
        tab: "offers",
        offersSubTab: "received"
      }
    },
    {
      kind: "createFarmCta",
      visible: hasProducerProfile,
      title: t("farmListScreen.createFarmCta"),
      target: { screen: "CreateFarm" }
    },
    {
      kind: "invite",
      visible: true,
      title: t("farmListScreen.inviteCode"),
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
      navigation.navigate("MarketplaceList", {
        tab: nav.tab ?? "offers",
        offersSubTab: nav.offersSubTab ?? "received"
      });
      return;
    case "CreateFarm":
      navigation.navigate("CreateFarm");
      return;
    case "AcceptFarmInvitation":
      navigation.navigate("AcceptFarmInvitation", nav.params);
      return;
  }
}
