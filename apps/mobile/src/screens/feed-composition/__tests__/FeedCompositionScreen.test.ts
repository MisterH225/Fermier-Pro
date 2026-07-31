import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { FeedCompositionScreen } from "../FeedCompositionScreen";
import {
  listFarmCompositionVeterinarians,
  postFeedCompositionAssist,
  postFeedCompositionFormulate,
  saveFeedComposition
} from "../../../lib/api";
import { ApiError } from "../../../lib/api/http";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "fr" } })
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() })
}));

const platformModules = [
  {
    moduleId: "feed_composition",
    moduleName: "feed_composition",
    icon: null,
    isActive: true,
    canDisable: true,
    userMessageFr: null,
    userMessageEn: null,
    scheduledReactivation: null
  }
];

jest.mock("../../../context/SessionContext", () => ({
  useSession: () => ({
    accessToken: "tok",
    activeProfileId: "prof-1",
    platformModules
  })
}));

jest.mock("../../../lib/api", () => ({
  listFarmCompositionVeterinarians: jest.fn(),
  postFeedCompositionAssist: jest.fn(),
  postFeedCompositionFormulate: jest.fn(),
  saveFeedComposition: jest.fn(),
  requestCompositionVetReview: jest.fn()
}));

jest.mock("@tanstack/react-query", () => {
  const actualReact = require("react") as typeof React;
  return {
    useQuery: (opts: { queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      const [data, setData] = actualReact.useState<unknown>(undefined);
      actualReact.useEffect(() => {
        if (opts.enabled === false) return;
        void opts.queryFn().then(setData);
      }, []);
      return { data, isPending: data === undefined };
    },
    useMutation: (opts: {
      mutationFn: (...args: unknown[]) => Promise<unknown>;
      onSuccess?: (res: unknown, vars: unknown) => void;
      onError?: (e: unknown, vars: unknown) => void;
    }) => {
      const [isPending, setPending] = actualReact.useState(false);
      return {
        isPending,
        mutate: (vars?: unknown) => {
          setPending(true);
          void opts
            .mutationFn(vars)
            .then((res) => {
              setPending(false);
              opts.onSuccess?.(res, vars);
            })
            .catch((e: unknown) => {
              setPending(false);
              opts.onError?.(e, vars);
            });
        },
        mutateAsync: (vars?: unknown) => opts.mutationFn(vars)
      };
    }
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const formulation = {
  feasible: true,
  ration: [
    {
      feedIngredientId: "corn",
      canonicalName: "Maïs",
      quantityKg: 70,
      proportionPct: 70,
      costContribution: 14000
    }
  ],
  totalFeedKg: 100,
  dailyIntakeKg: 1.5,
  totalCostXof: 20000,
  costPerKg: 200,
  nutritionResult: {
    crudeProteinPct: 16,
    metabolizableEnergyKcal: 3200,
    lysinePct: 0.95,
    methioninePct: 0.28,
    calciumPct: 0.7,
    phosphorusPct: 0.5,
    crudeFiberPct: 4,
    lysinePerMcal: 2.97
  },
  deviations: [
    { nutrient: "Protéine", target: "≥ 15", actual: 16, withinBounds: true }
  ],
  warnings: [],
  infeasibilityReasons: []
};

const infeasible = {
  ...formulation,
  feasible: false,
  ration: [],
  totalCostXof: 0,
  costPerKg: 0,
  infeasibilityReasons: ["protéine insuffisante"]
};

type TestNode = {
  props: { testID?: string; onPress?: () => void; [k: string]: unknown };
  children: Array<string | TestNode>;
  findByProps: (p: Record<string, unknown>) => TestNode;
  findAll: (pred: (n: TestNode) => boolean) => TestNode[];
};

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function findByTestId(root: TestNode, testID: string): TestNode | null {
  try {
    return root.findByProps({ testID });
  } catch {
    return null;
  }
}

const nav = { navigate: jest.fn(), setOptions: jest.fn() };
const route = {
  key: "k",
  name: "FeedComposition" as const,
  params: { farmId: "farm-1", farmName: "Ferme Test" }
};

describe("FeedCompositionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listFarmCompositionVeterinarians as jest.Mock).mockResolvedValue([
      { userId: "vet-1", fullName: "Dr Vet", phone: null, email: null }
    ]);
  });

  it("affiche le mode assisté par défaut + disclaimer", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    expect(findByTestId(root, "composition-disclaimer")).toBeTruthy();
    expect(findByTestId(root, "assist-chat-panel")).toBeTruthy();
    expect(findByTestId(root, "formulate-form")).toBeNull();
  });

  it("bascule vers le formulaire", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    await act(async () => {
      findByTestId(root, "mode-form")?.props.onPress?.();
    });
    expect(findByTestId(root, "formulate-form")).toBeTruthy();
  });

  it("bascule en mode dégradé si /assist échoue (AI_UNAVAILABLE)", async () => {
    (postFeedCompositionAssist as jest.Mock).mockRejectedValue(
      new ApiError("IA down", 503, "AI_UNAVAILABLE")
    );
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    await act(async () => {
      const input = findByTestId(root, "assist-chat-input");
      const onChangeText = input?.props.onChangeText as
        | ((t: string) => void)
        | undefined;
      onChangeText?.("30 porcs engraissement");
    });
    await act(async () => {
      findByTestId(root, "assist-chat-send")?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(findByTestId(root, "degraded-note")).toBeTruthy();
    expect(findByTestId(root, "formulate-form")).toBeTruthy();
  });

  it("formulaire → affiche ration faisable + coût", async () => {
    (postFeedCompositionFormulate as jest.Mock).mockResolvedValue({
      formulation,
      isTheoretical: true,
      millProfileId: null
    });
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    await act(async () => {
      findByTestId(root, "mode-form")?.props.onPress?.();
    });
    await act(async () => {
      findByTestId(root, "formulate-submit")?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(findByTestId(root, "formulation-result")).toBeTruthy();
    expect(findByTestId(root, "formulation-total-cost")).toBeTruthy();
    expect(findByTestId(root, "save-composition")).toBeTruthy();
    expect(findByTestId(root, "send-to-vet")).toBeTruthy();
  });

  it("cas infaisable : message clair, pas de tableau trompeur", async () => {
    (postFeedCompositionFormulate as jest.Mock).mockResolvedValue({
      formulation: infeasible,
      isTheoretical: true,
      millProfileId: null
    });
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    await act(async () => {
      findByTestId(root, "mode-form")?.props.onPress?.();
    });
    await act(async () => {
      findByTestId(root, "formulate-submit")?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(findByTestId(root, "formulation-infeasible")).toBeTruthy();
    expect(findByTestId(root, "save-composition")).toBeNull();
  });

  it("masque envoi véto s’il n’y a pas de véto associé", async () => {
    (listFarmCompositionVeterinarians as jest.Mock).mockResolvedValue([]);
    (postFeedCompositionFormulate as jest.Mock).mockResolvedValue({
      formulation,
      isTheoretical: false,
      millProfileId: "mill-1"
    });
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    await act(async () => {
      findByTestId(root, "mode-form")?.props.onPress?.();
    });
    await act(async () => {
      findByTestId(root, "formulate-submit")?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(findByTestId(root, "save-composition")).toBeTruthy();
    expect(findByTestId(root, "send-to-vet")).toBeNull();
  });

  it("enregistre une composition faisable", async () => {
    (postFeedCompositionFormulate as jest.Mock).mockResolvedValue({
      formulation,
      isTheoretical: true,
      millProfileId: null
    });
    (saveFeedComposition as jest.Mock).mockResolvedValue({
      id: "comp-1",
      status: "draft"
    });
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(FeedCompositionScreen, {
          navigation: nav as never,
          route: route as never
        })
      );
      await Promise.resolve();
    });
    const root = renderer.root as unknown as TestNode;
    await act(async () => {
      findByTestId(root, "mode-form")?.props.onPress?.();
    });
    await act(async () => {
      findByTestId(root, "formulate-submit")?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      findByTestId(root, "save-composition")?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(saveFeedComposition).toHaveBeenCalled();
  });
});
