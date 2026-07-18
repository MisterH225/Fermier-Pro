import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { METEO_LEVELS } from "../../../constants/meteoProfil";
import { MeteoHeaderButton } from "../MeteoHeaderButton";
import {
  meteoHeaderSnapshotForScore,
  profileHasMeteoScore,
  resolveMeteoHeaderPresentation
} from "../meteoHeaderModel";
import { buildProducerScorePillarsV1 } from "../meteoPillars";

const mockNav = { navigate: jest.fn() };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNav
}));

jest.mock("../../../hooks/useMeteoScore", () => ({
  useMeteoScore: () => ({
    data: {
      numericScore: 88,
      isNew: false,
      apiLabel: "Excellent",
      emoji: "⭐",
      color: "#1D9E75"
    },
    isPending: false
  })
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function unmount(renderer: ReactTestRenderer) {
  act(() => {
    renderer.unmount();
  });
}

function findByTestId(
  renderer: ReactTestRenderer,
  testID: string
): { props: { onPress?: () => void; accessibilityLabel?: string } } {
  const nodes = renderer.root.findAll(
    (node) => (node.props as { testID?: string }).testID === testID
  );
  if (nodes.length === 0) {
    throw new Error(`testID ${testID} introuvable`);
  }
  return nodes[0] as {
    props: { onPress?: () => void; accessibilityLabel?: string };
  };
}

describe("meteoHeaderModel", () => {
  it("snapshot icône / teinte par niveau (score 0–100)", () => {
    const snapshots = METEO_LEVELS.map((level) => {
      const mid = Math.round((level.range_min + level.range_max) / 2);
      return {
        levelId: level.id,
        ...meteoHeaderSnapshotForScore(mid)
      };
    });
    expect(snapshots).toMatchSnapshot();
  });

  it("état nouvelle → icône neutre sans teinte d'alerte", () => {
    const p = resolveMeteoHeaderPresentation({ score: 10, isNew: true });
    expect(p.isNew).toBe(true);
    expect(p.tint).toBe("#9E9E9E");
    expect(p.accessibilityLabel).toBe("Météo de confiance : Nouveau");
  });

  it("seuls les profils avec score exposent l'icône (v1 = producteur)", () => {
    expect(profileHasMeteoScore("producer")).toBe(true);
    expect(profileHasMeteoScore("buyer")).toBe(false);
    expect(profileHasMeteoScore("merchant")).toBe(false);
    expect(profileHasMeteoScore("vet")).toBe(false);
    expect(profileHasMeteoScore("technician")).toBe(false);
  });
});

describe("MeteoHeaderButton", () => {
  beforeEach(() => {
    mockNav.navigate.mockClear();
  });

  it("navigue vers ProducerScoreDashboard au tap", () => {
    const renderer = render(
      React.createElement(MeteoHeaderButton, { profileType: "producer" })
    );
    const pressable = findByTestId(renderer, "meteo-header-button");
    act(() => {
      pressable.props.onPress?.();
    });
    expect(mockNav.navigate).toHaveBeenCalledWith("ProducerScoreDashboard");
    unmount(renderer);
  });

  it("n'affiche rien pour un profil sans score", () => {
    const renderer = render(
      React.createElement(MeteoHeaderButton, { profileType: "buyer" })
    );
    expect(renderer.toJSON()).toBeNull();
    unmount(renderer);
  });

  it("expose l'accessibilité météo de confiance", () => {
    const renderer = render(
      React.createElement(MeteoHeaderButton, { profileType: "producer" })
    );
    const pressable = findByTestId(renderer, "meteo-header-button");
    expect(pressable.props.accessibilityLabel).toMatch(
      /^Météo de confiance :/
    );
    unmount(renderer);
  });
});

describe("meteoPillars (préparation v2)", () => {
  it("construit une liste dynamique labelKey / hint (données v1)", () => {
    const pillars = buildProducerScorePillarsV1(
      {
        dataRegularityScore: 80,
        platformUsageScore: 70,
        responsivenessScore: 90,
        chatScore: 60,
        dataEntryDaysLast30: 12,
        platformActiveDaysLast30: 10,
        offersRespondedWithin48h: 4,
        offersReceivedCount: 5,
        chatRepliedWithin24h: 3,
        chatBuyerMessagesCount: 5
      },
      (key) => key
    );
    expect(pillars).toHaveLength(4);
    expect(pillars.every((p) => p.labelKey && typeof p.score === "number")).toBe(
      true
    );
    expect(pillars[0]!.hint).toBeTruthy();
  });
});
