import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { ProfileType } from "@fermier/types";

type TestNode = {
  props: Record<string, unknown>;
  parent: TestNode | null;
  findByProps: (props: Record<string, unknown>) => TestNode;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

let mockProfileType: ProfileType = "buyer";
let mockFarmSettingsEnabled = true;

const mockFarmSettings = {
  farm: {
    id: "farm-1",
    name: "Ferme Test",
    speciesFocus: "pig",
    livestockMode: "individual" as const,
    address: null,
    locationSector: null,
    locationCity: "Dakar",
    locationCountry: "SN",
    latitude: null,
    longitude: null,
    housingBuildingsCount: null,
    housingPensPerBuilding: null,
    housingMaxPigsPerPen: null
  },
  app: {
    language: "fr" as const,
    dateFormat: "DD/MM/YYYY",
    timezone: "Africa/Dakar",
    theme: "system" as const,
    budgetAutoSuggest: false,
    dailySummaryHour: null,
    notificationExtra: null
  },
  finance: {
    currencyCode: "XOF",
    currencySymbol: "F",
    lowBalanceThreshold: null
  },
  alerts: {
    mortalityRateThresholdPct: 5,
    lowBalanceThreshold: null,
    stockWarningDays: 7,
    stockCriticalDays: 3,
    starterMaxAvgWeightKg: 30,
    starterMaxAvgAgeWeeks: 10,
    pushStock: true,
    pushHealth: true,
    pushFinance: true,
    pushGestation: true,
    pushCheptel: true,
    pushMarket: true
  },
  gestation: {
    gestationDurationDays: 114,
    weaningDurationDays: 28,
    vaccineSchedule: null
  },
  profitability: {
    marketPricePerKg: null,
    icTargetStarter: null,
    icTargetGrowth: null,
    icTargetFattening: null,
    gmqRefStarter: 250,
    gmqRefGrowth: 450,
    gmqRefFattening: 600
  },
  gmqTargets: {
    gmqTargetStarter: null,
    gmqTargetGrowth: null,
    gmqTargetFattening: null,
    targetSaleWeightKg: null
  }
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr", resolvedLanguage: "fr", changeLanguage: jest.fn() }
  })
}));

jest.mock("@expo/vector-icons", () => {
  const ReactModule = require("react") as typeof React;
  return {
    Ionicons: (props: Record<string, unknown>) =>
      ReactModule.createElement("Icon", props)
  };
});

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0", ios: { buildNumber: "1" } } }
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey: unknown[]; enabled?: boolean }) => {
    const key = String(opts.queryKey?.[0] ?? "");
    if (key === "cguCurrent") {
      return { data: null, isPending: false, error: null, refetch: jest.fn() };
    }
    if (key === "farmSettings") {
      if (!opts.enabled || !mockFarmSettingsEnabled) {
        return {
          data: undefined,
          isPending: false,
          error: null,
          refetch: jest.fn()
        };
      }
      return {
        data: mockFarmSettings,
        isPending: false,
        error: null,
        refetch: jest.fn()
      };
    }
    return { data: undefined, isPending: false, error: null, refetch: jest.fn() };
  },
  useMutation: () => ({
    mutate: jest.fn(),
    isPending: false
  }),
  useQueryClient: () => ({
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn()
  })
}));

jest.mock("../../../context/SessionContext", () => ({
  useSession: () => ({
    accessToken: "token",
    activeProfileId: "profile-1",
    authMe: {
      user: {
        email: "u@test.com",
        fullName: "Test User",
        notificationsEnabled: false
      },
      profiles: [{ id: "profile-1", type: mockProfileType }],
      activeProfile: { id: "profile-1", type: mockProfileType }
    },
    signOut: jest.fn(),
    reloadAuth: jest.fn(),
    refreshAuthMe: jest.fn(),
    clientFeatures: { finance: true, feedStock: true, wallet: true }
  })
}));

jest.mock("../../../hooks/useScreenTitle", () => ({
  useScreenTitle: jest.fn()
}));

jest.mock("../../../hooks/useScrollBottomPad", () => ({
  useScrollBottomPad: () => 24
}));

jest.mock("../../../hooks/useSettingsSavedToast", () => ({
  useSettingsSavedToast: () => ({
    savedToastVisible: false,
    savedToastMessage: "",
    showSaved: jest.fn()
  })
}));

jest.mock("../../../lib/api", () => ({
  fetchFarmSettings: jest.fn(),
  patchFarmSettings: jest.fn()
}));

jest.mock("../../../lib/api/auth", () => ({
  fetchCguCurrent: jest.fn()
}));

jest.mock("../../../components/account/AccountSettingsPanel", () => {
  const ReactModule = require("react") as typeof React;
  return {
    AccountSettingsPanel: (props: { accountOnly?: boolean }) =>
      ReactModule.createElement("AccountSettingsPanel", {
        testID: "account-settings-panel",
        accountOnly: props.accountOnly ? "true" : "false"
      })
  };
});

jest.mock("../../../components/account/NotificationSettingsRow", () => {
  const ReactModule = require("react") as typeof React;
  return {
    NotificationSettingsRow: () =>
      ReactModule.createElement("NotificationSettingsRow", {
        testID: "notification-settings-row"
      })
  };
});

jest.mock("../../../components/settings/LanguageModal", () => ({
  LanguageModal: () => null
}));
jest.mock("../../../components/settings/CurrencyModal", () => ({
  CurrencyModal: () => null,
  CURRENCY_OPTIONS: [{ code: "XOF", label: "Franc CFA (XOF)" }]
}));
jest.mock("../../../components/settings/BreedingModeModal", () => ({
  BreedingModeModal: () => null
}));
jest.mock("../../../components/settings/ThresholdModal", () => ({
  ThresholdModal: () => null
}));
jest.mock("../../../components/settings/LegalDocumentModal", () => ({
  LegalDocumentModal: () => null
}));
jest.mock("../../../components/modals/BaseModal", () => ({
  BaseModal: () => null
}));

import { SettingsScreen } from "../SettingsScreen";

function renderForRole(
  role: ProfileType,
  params?: { farmId?: string; farmName?: string }
): ReactTestRenderer {
  mockProfileType = role;
  mockFarmSettingsEnabled = role === "producer";
  mockNavigate.mockClear();

  const navigation = {
    navigate: mockNavigate,
    setOptions: mockSetOptions,
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn())
  };

  const route = {
    key: "settings",
    name: "ProducerFarmSettings" as const,
    params
  };

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(SettingsScreen, {
        navigation: navigation as never,
        route: route as never
      })
    );
  });
  return renderer;
}

function unmount(renderer: ReactTestRenderer) {
  act(() => {
    renderer.unmount();
  });
}

function findByTestId(root: TestNode, testID: string): TestNode | null {
  try {
    return root.findByProps({ testID });
  } catch {
    return null;
  }
}

function findPressableByLabel(root: TestNode, label: string): TestNode | null {
  const texts = root.findAll((node) => node.props?.children === label);
  for (const text of texts) {
    let cur: TestNode | null = text;
    while (cur) {
      if (typeof cur.props?.onPress === "function") {
        return cur;
      }
      cur = cur.parent;
    }
  }
  return null;
}

describe("SettingsScreen — socle multi-rôles", () => {
  const roles: ProfileType[] = [
    "producer",
    "technician",
    "veterinarian",
    "buyer",
    "merchant"
  ];

  it.each(roles)("rend le socle commun pour le rôle %s", (role) => {
    const params =
      role === "producer"
        ? { farmId: "farm-1", farmName: "Ferme Test" }
        : undefined;
    const renderer = renderForRole(role, params);
    const root = renderer.root as unknown as TestNode;

    expect(findByTestId(root, "settings-screen")).not.toBeNull();
    expect(findByTestId(root, "settings-common-base")).not.toBeNull();
    expect(findByTestId(root, "account-settings-panel")).not.toBeNull();
    expect(findByTestId(root, "notification-settings-row")).not.toBeNull();
    expect(findByTestId(root, "settings-notifications")).not.toBeNull();

    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain("settings.language");
    expect(json).toContain("account.dangerZone.deleteAccount");
    expect(json).toContain("cgu.title");
    expect(json).toContain("cgu.privacy.title");

    unmount(renderer);
  });

  it("affiche les sections producteur uniquement pour le producteur", () => {
    const producer = renderForRole("producer", {
      farmId: "farm-1",
      farmName: "Ferme Test"
    });
    expect(
      findByTestId(producer.root as unknown as TestNode, "settings-producer-sections")
    ).not.toBeNull();
    const producerJson = JSON.stringify(producer.toJSON());
    expect(producerJson).toContain("settings.sectionFarm");
    expect(producerJson).toContain("settings.sectionRegional");
    expect(producerJson).toContain("settings.expenseCategories");
    unmount(producer);

    for (const role of ["buyer", "veterinarian", "technician", "merchant"] as ProfileType[]) {
      const renderer = renderForRole(role);
      expect(
        findByTestId(renderer.root as unknown as TestNode, "settings-producer-sections")
      ).toBeNull();
      const json = JSON.stringify(renderer.toJSON());
      expect(json).not.toContain("settings.sectionFarm");
      unmount(renderer);
    }
  });

  it("expose le lien profil technicien uniquement pour le technicien", () => {
    const tech = renderForRole("technician");
    expect(
      findByTestId(tech.root as unknown as TestNode, "settings-technician-sections")
    ).not.toBeNull();
    expect(JSON.stringify(tech.toJSON())).toContain("tech.profile.edit");
    unmount(tech);

    const buyer = renderForRole("buyer");
    expect(
      findByTestId(buyer.root as unknown as TestNode, "settings-technician-sections")
    ).toBeNull();
    unmount(buyer);
  });

  it.each(roles)(
    "navigue vers DeleteAccountProcess depuis le rôle %s",
    (role) => {
      const params =
        role === "producer"
          ? { farmId: "farm-1", farmName: "Ferme Test" }
          : undefined;
      const renderer = renderForRole(role, params);
      const btn = findPressableByLabel(
        renderer.root as unknown as TestNode,
        "account.dangerZone.deleteAccount"
      );
      expect(btn).not.toBeNull();
      act(() => {
        (btn!.props.onPress as () => void)();
      });
      expect(mockNavigate).toHaveBeenCalledWith("DeleteAccountProcess");
      unmount(renderer);
    }
  );
});
