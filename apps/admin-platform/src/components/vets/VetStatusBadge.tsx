import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  pending: "warning",
  verified: "success",
  rejected: "danger"
};

type Props = {
  status: string;
  label?: string;
};

export function VetStatusBadge({ status, label }: Props) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "outline"}
      className={cn("capitalize")}
    >
      {label ?? status}
    </Badge>
  );
}
