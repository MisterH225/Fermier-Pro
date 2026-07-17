import {
  merchantOrderPalette,
  OrderContactCard
} from "../../orders";

type Props = {
  name: string;
  subtitle: string;
  phone?: string | null;
  onMessage: () => void;
  messageBusy?: boolean;
};

export function MerchantOrderContactCard({
  name,
  subtitle,
  phone,
  onMessage,
  messageBusy
}: Props) {
  return (
    <OrderContactCard
      displayName={name}
      subtitle={subtitle}
      phone={phone}
      onMessage={onMessage}
      messageBusy={messageBusy}
      palette={merchantOrderPalette}
    />
  );
}
