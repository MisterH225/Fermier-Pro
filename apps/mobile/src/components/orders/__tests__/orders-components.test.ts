import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { OrderStatusBadge } from "../OrderStatusBadge";
import {
  OrderTrackingStepper,
  type OrderTrackingStep
} from "../OrderTrackingStepper";
import { ordersPalette } from "../orderTheme";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "fr" }
  })
}));

jest.mock("@expo/vector-icons", () => {
  const ReactModule = require("react") as typeof React;
  return {
    Ionicons: (props: Record<string, unknown>) =>
      ReactModule.createElement("Icon", props)
  };
});

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

function steps(count: number): OrderTrackingStep[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `step-${index}`,
    labelKey: `orders.step.${index}`,
    icon: "cube-outline",
    timestamp:
      index === 0 ? "2026-07-17T10:30:00.000Z" : null
  }));
}

describe("OrderTrackingStepper", () => {
  it("rend un stepper de 3 étapes", () => {
    const renderer = render(
      React.createElement(OrderTrackingStepper, {
        steps: steps(3),
        activeIndex: 1
      })
    );

    const json = JSON.stringify(renderer.toJSON());
    expect(json.match(/orders\.step\./g)).toHaveLength(3);
    expect(json).toContain("checkmark");
    unmount(renderer);
  });

  it("rend un stepper de 5 étapes", () => {
    const renderer = render(
      React.createElement(OrderTrackingStepper, {
        steps: steps(5),
        activeIndex: 3
      })
    );

    const json = JSON.stringify(renderer.toJSON());
    expect(json.match(/orders\.step\./g)).toHaveLength(5);
    unmount(renderer);
  });

  it("ajoute un badge d’alerte sur l’étape disputée", () => {
    const renderer = render(
      React.createElement(OrderTrackingStepper, {
        steps: steps(4),
        activeIndex: 2,
        disputedIndex: 2
      })
    );

    const json = JSON.stringify(renderer.toJSON());
    expect(json.match(/"name":"warning"/g)).toHaveLength(1);
    expect(json).toContain(ordersPalette.danger);
    unmount(renderer);
  });
});

describe("OrderStatusBadge", () => {
  const tones = [
    "pending",
    "active",
    "success",
    "danger",
    "neutral"
  ] as const;

  it.each(tones)("rend le tone %s avec sa surface", (tone) => {
    const renderer = render(
      React.createElement(OrderStatusBadge, {
        labelKey: `orders.status.${tone}`,
        tone
      })
    );

    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain(`orders.status.${tone}`);
    expect(json).toContain(ordersPalette.badges[tone].background);
    expect(json).toContain(ordersPalette.badges[tone].foreground);
    unmount(renderer);
  });
});
