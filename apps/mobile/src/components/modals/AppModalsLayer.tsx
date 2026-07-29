import { SuccessModal } from "./SuccessModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { EditTransactionModal } from "./EditTransactionModal";
import { TransactionModal } from "./TransactionModal";
import { UpgradeLimitModal } from "../subscription/UpgradeLimitModal";
import { useModalContext } from "../../context/ModalContext";

export function AppModalsLayer() {
  const { current, close } = useModalContext();

  if (!current) {
    return null;
  }

  if (current.type === "transaction") {
    return (
      <TransactionModal
        visible
        payload={current.payload}
        onClose={close}
      />
    );
  }

  if (current.type === "edit-transaction") {
    return (
      <EditTransactionModal
        visible
        payload={current.payload}
        onClose={close}
      />
    );
  }

  if (current.type === "success") {
    return (
      <SuccessModal
        visible
        payload={current.payload}
        onClose={close}
      />
    );
  }

  if (current.type === "upgrade-limit") {
    return (
      <UpgradeLimitModal
        visible
        payload={current.payload}
        onClose={close}
      />
    );
  }

  return (
    <ConfirmDeleteModal
      visible
      payload={current.payload}
      onClose={close}
    />
  );
}
