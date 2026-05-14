import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { BatchListItem, FinanceCategoryDto } from "../lib/api";

export type TransactionModalPayload = {
  farmId: string;
  farmName: string;
  accessToken: string;
  activeProfileId?: string | null;
  categories: FinanceCategoryDto[];
  batches: BatchListItem[];
  currencyCode: string;
  currencySymbol: string;
  transactionRef: string;
};

export type SuccessModalPayload = {
  message: string;
  title?: string;
  autoDismissMs?: number;
};

export type ConfirmDeleteModalPayload = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export type AppModalState =
  | { type: "transaction"; payload: TransactionModalPayload }
  | { type: "success"; payload: SuccessModalPayload }
  | { type: "confirm-delete"; payload: ConfirmDeleteModalPayload };

type ModalContextValue = {
  current: AppModalState | null;
  isVisible: boolean;
  open: (state: AppModalState) => void;
  close: () => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AppModalState | null>(null);

  const open = useCallback((state: AppModalState) => {
    setCurrent(state);
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
  }, []);

  const value = useMemo(
    () => ({
      current,
      isVisible: current !== null,
      open,
      close
    }),
    [current, open, close]
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}

export function useModalContext(): ModalContextValue {
  const v = useContext(ModalContext);
  if (!v) {
    throw new Error("useModalContext doit être utilisé sous ModalProvider");
  }
  return v;
}
