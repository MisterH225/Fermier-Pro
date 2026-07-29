import {
  OrderContactCard,
  type OrderPalette
} from "../../orders";
import { useOrderPalette } from "../../../hooks/useOrderPalette";

type Props = {
  name: string;
  subtitle: string;
  phone?: string | null;
  onMessage: () => void;
  messageBusy?: boolean;
  palette?: OrderPalette;
};

export function MerchantOrderContactCard({
  name,
  subtitle,
  phone,
  onMessage,
  messageBusy,
  palette
}: Props) {
  const rolePalette = useOrderPalette();
  const resolved = palette ?? rolePalette;
  return (
    <OrderContactCard
      displayName={name}
      subtitle={subtitle}
      phone={phone}
      onMessage={onMessage}
      messageBusy={messageBusy}
      palette={resolved}
    />
  );
}
