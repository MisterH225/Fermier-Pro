import { SuccessModal } from "./SuccessModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { TransactionModal } from "./TransactionModal";
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

  if (current.type === "success") {
    return (
      <SuccessModal
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
