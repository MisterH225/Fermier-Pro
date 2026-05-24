import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  verified: "bg-green-100 text-green-900 border-green-200",
  rejected: "bg-red-100 text-red-900 border-red-200"
};

type Props = {
  status: string;
  label?: string;
};

export function VetStatusBadge({ status, label }: Props) {
  return (
    <Badge variant="outline" className={cn("capitalize", STATUS_CLASS[status] ?? "")}>
      {label ?? status}
    </Badge>
  );
}
