import { useCallback, useMemo } from "react";
import {
  useModalContext,
  type AppModalState,
  type ConfirmDeleteModalPayload,
  type SuccessModalPayload,
  type TransactionModalPayload
} from "../../context/ModalContext";

type OpenFn = {
  (type: "transaction", payload: TransactionModalPayload): void;
  (type: "success", payload: SuccessModalPayload): void;
  (type: "confirm-delete", payload: ConfirmDeleteModalPayload): void;
};

export function useModal() {
  const ctx = useModalContext();

  const open = useCallback<OpenFn>(
    ((type: AppModalState["type"], payload: unknown) => {
      ctx.open({ type, payload } as AppModalState);
    }) as OpenFn,
    [ctx]
  );

  return useMemo(
    () => ({
      isVisible: ctx.isVisible,
      current: ctx.current,
      close: ctx.close,
      open
    }),
    [ctx, open]
  );
}
