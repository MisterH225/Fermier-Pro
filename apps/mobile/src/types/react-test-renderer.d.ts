declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export type ReactTestInstance = {
    props: Record<string, unknown>;
    findAll(
      predicate: (node: ReactTestInstance) => boolean
    ): ReactTestInstance[];
    findByType(type: unknown): ReactTestInstance;
    findAllByType(type: unknown): ReactTestInstance[];
  };

  export type ReactTestRenderer = {
    root: ReactTestInstance;
    toJSON(): unknown;
    unmount(): void;
  };

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void): void;
}
