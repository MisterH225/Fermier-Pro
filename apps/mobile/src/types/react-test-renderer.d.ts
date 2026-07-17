declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export type ReactTestRenderer = {
    root: {
      findAll(
        predicate: (node: { props: Record<string, unknown> }) => boolean
      ): Array<{ props: Record<string, unknown> }>;
      findByType(type: unknown): { props: Record<string, unknown> };
    };
    toJSON(): unknown;
    unmount(): void;
  };

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void): void;
}
