import { WalletDashboardCard } from "./WalletDashboardCard";

type Props = {
  variant?: "buyer" | "producer" | "vet" | "tech";
};

export function WalletPanel({ variant = "producer" }: Props) {
  return <WalletDashboardCard variant={variant} />;
}
