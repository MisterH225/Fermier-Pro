import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchCheptelHistory, type CheptelHistoryItemDto } from "../../../lib/api";
import { EventList, type EventItem } from "../../lists";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
};

function iconForType(
  type: CheptelHistoryItemDto["type"]
): EventItem["iconType"] {
  switch (type) {
    case "weight":
      return "check";
    case "transfer":
      return "in";
    case "creation":
      return "in";
    case "status":
      return "out";
    default:
      return "check";
  }
}

export function CheptelHistory({
  farmId,
  accessToken,
  activeProfileId,
  refreshing,
  onRefresh
}: Props) {
  const { t } = useTranslation();
  const [filterId, setFilterId] = useState("all");

  const typeParam =
    filterId === "all"
      ? undefined
      : filterId === "statuses"
        ? "status"
        : filterId === "weights"
          ? "weight"
          : filterId === "transfers"
            ? "transfer"
            : filterId === "creations"
              ? "creation"
              : undefined;

  const historyQuery = useQuery({
    queryKey: ["cheptelHistory", farmId, activeProfileId, typeParam],
    queryFn: () =>
      fetchCheptelHistory(accessToken, farmId, activeProfileId, {
        type: typeParam,
        limit: 250
      })
  });

  const filters = useMemo(
    () => [
      { id: "all", label: t("cheptel.history.filter.all") },
      { id: "creations", label: t("cheptel.history.filter.creations") },
      { id: "transfers", label: t("cheptel.history.filter.transfers") },
      { id: "statuses", label: t("cheptel.history.filter.statuses") },
      { id: "weights", label: t("cheptel.history.filter.weights") }
    ],
    [t]
  );

  const events: EventItem[] = useMemo(() => {
    return (historyQuery.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle ?? undefined,
      valueType: "neutral" as const,
      date: new Date(r.occurredAt).toLocaleDateString("fr-FR"),
      iconType: iconForType(r.type),
      meta: r
    }));
  }, [historyQuery.data]);

  return (
    <EventList
      layout="embedded"
      data={events}
      filters={filters}
      activeFilterId={filterId}
      onFilterChange={setFilterId}
      isLoading={historyQuery.isPending}
      emptyMessage={t("cheptel.noLogs")}
      refreshing={refreshing}
      onRefresh={() => {
        void historyQuery.refetch();
        onRefresh?.();
      }}
      pageSize={30}
      loadMoreLabel={t("cheptel.loadMore")}
    />
  );
}
