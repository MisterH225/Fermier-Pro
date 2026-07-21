import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ScheduleVisitModal } from "../ScheduleVisitModal";

type TestNode = {
  children: Array<string | TestNode>;
  props: { onPress?: () => void; [key: string]: unknown };
  findByProps: (props: Record<string, unknown>) => TestNode;
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr" }
  })
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn()
  }),
  useQuery: () => ({
    data: [{ id: "farm-1", name: "La ferme de Jacob" }],
    isPending: false
  }),
  useMutation: (opts: {
    mutationFn: () => Promise<unknown>;
    onSuccess?: (res: unknown) => void;
    onError?: (e: unknown) => void;
  }) => ({
    mutate: () => {
      void opts.mutationFn();
    },
    isPending: false
  })
}));

jest.mock("../../../context/SessionContext", () => ({
  useSession: () => ({
    accessToken: "tok",
    activeProfileId: "prof-1",
    platformFees: { vetCommissionRate: 0.05 }
  })
}));

jest.mock("../../modals/useModal", () => ({
  useModal: () => ({ open: jest.fn() })
}));

jest.mock("../../modals/BaseModal", () => {
  const ReactModule = require("react") as typeof React;
  return {
    BaseModal: (props: {
      children: React.ReactNode;
      footerPrimary?: React.ReactNode;
      title?: string;
    }) =>
      ReactModule.createElement(
        "BaseModal",
        { title: props.title },
        props.children,
        props.footerPrimary
      )
  };
});

jest.mock("../../common/PlatformFeePreview", () => {
  const ReactModule = require("react") as typeof React;
  return {
    PlatformFeePreview: () =>
      ReactModule.createElement("PlatformFeePreview", null)
  };
});

jest.mock("../../../lib/api", () => ({
  fetchFarms: jest.fn(),
  scheduleVetVisit: jest.fn()
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

function findByTestId(root: TestNode, testID: string): TestNode | null {
  try {
    return root.findByProps({ testID });
  } catch {
    return null;
  }
}

describe("ScheduleVisitModal", () => {
  it("affiche le champ montant lorsque Payante est sélectionné", () => {
    const renderer = render(
      React.createElement(ScheduleVisitModal, {
        visible: true,
        onClose: jest.fn(),
        selectedDay: new Date("2026-07-21T10:00:00.000Z"),
        selectedSlot: "10:00"
      })
    );

    expect(
      findByTestId(renderer.root as unknown as TestNode, "schedule-visit-price-input")
    ).toBeNull();

    function nodeHasText(node: TestNode, text: string): boolean {
      if (node.children.includes(text)) {
        return true;
      }
      return node.children.some(
        (child) => typeof child !== "string" && nodeHasText(child, text)
      );
    }

    const root = renderer.root as unknown as TestNode;
    const paidPressable = root.findAll(
      (node) =>
        typeof node.props?.onPress === "function" &&
        nodeHasText(node, "vet.schedule.pricingPaid")
    )[0];
    expect(paidPressable).toBeTruthy();

    act(() => {
      paidPressable.props.onPress?.();
    });

    const priceInput = findByTestId(root, "schedule-visit-price-input");
    expect(priceInput).not.toBeNull();
    expect(priceInput!.props.placeholder).toBe(
      "vet.schedule.pricePlaceholder"
    );
    expect(priceInput!.props.keyboardType).toBe("decimal-pad");
    expect(findByTestId(root, "schedule-visit-price-block")).not.toBeNull();

    act(() => {
      renderer.unmount();
    });
  });

  it("n’importe plus de scroll imbriqué (évite le clip du champ montant)", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "../ScheduleVisitModal.tsx"),
      "utf8"
    ) as string;
    const importBlock = source.slice(
      source.indexOf('from "react-native"') - 120,
      source.indexOf('from "react-native"') + 40
    );
    expect(importBlock).not.toContain("ScrollView");
    expect(source).not.toMatch(/maxHeight:\s*420/);
    expect(source).toContain("schedule-visit-price-input");
  });
});
