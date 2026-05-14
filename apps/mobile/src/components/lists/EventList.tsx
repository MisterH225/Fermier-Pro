import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BaseModal } from "../modals/BaseModal";
import { EventListFilter } from "./EventListFilter";
import { EventListItem } from "./EventListItem";
import type { EventItem, FilterPill } from "./types";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const LIST_BG = "#F5F5F5";

export type EventListProps = {
  data: EventItem[];
  filters?: FilterPill[];
  activeFilterId?: string;
  onFilterChange?: (id: string) => void;
  onItemPress?: (item: EventItem) => void;
  renderDetail?: (item: EventItem, ctx: { close: () => void }) => ReactNode;
  onAddPress?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  layout?: "flatlist" | "embedded";
  pageSize?: number;
  prependContent?: ReactNode | null;
  sectionTitle?: string;
  sectionRight?: ReactNode;
  loadMoreLabel?: string;
  testID?: string;
};

function SkeletonBlock() {
  return (
    <View style={styles.skelCard}>
      <View style={styles.skelRow}>
        <View style={styles.skelCircle} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={styles.skelLineLg} />
          <View style={styles.skelLineSm} />
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={[styles.skelLineSm, { width: 72 }]} />
          <View style={[styles.skelLineSm, { width: 48 }]} />
        </View>
      </View>
    </View>
  );
}

export function EventList({
  data,
  filters = [],
  activeFilterId = "",
  onFilterChange,
  onItemPress,
  renderDetail,
  onAddPress,
  isLoading = false,
  emptyMessage = "",
  refreshing = false,
  onRefresh,
  layout = "flatlist",
  pageSize = 20,
  prependContent = null,
  sectionTitle,
  sectionRight,
  loadMoreLabel = "…",
  testID
}: EventListProps) {
  const [limit, setLimit] = useState(pageSize);
  const [selected, setSelected] = useState<EventItem | null>(null);

  useEffect(() => {
    setLimit(pageSize);
  }, [data, pageSize]);

  const visible = useMemo(() => data.slice(0, limit), [data, limit]);
  const canLoadMore = limit < data.length;

  const openItem = useCallback(
    (item: EventItem) => {
      onItemPress?.(item);
      if (renderDetail) {
        setSelected(item);
      }
    },
    [onItemPress, renderDetail]
  );

  const renderRow: ListRenderItem<EventItem> = useCallback(
    ({ item }) => <EventListItem item={item} onPress={() => openItem(item)} />,
    [openItem]
  );

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.embedPad}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="journal-outline" size={48} color={mobileColors.border} />
        <Text style={styles.emptyTx}>{emptyMessage}</Text>
      </View>
    );
  }, [isLoading, emptyMessage]);

  const header = (
    <View style={styles.headerBlock}>
      {sectionTitle || sectionRight || onAddPress ? (
        <View style={styles.sectionRow}>
          {sectionTitle ? (
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {sectionRight}
            {onAddPress ? (
              <Pressable onPress={onAddPress} hitSlop={8} accessibilityRole="button">
                <Text style={styles.addTx}>＋</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {filters.length > 0 && activeFilterId && onFilterChange ? (
        <EventListFilter pills={filters} activeId={activeFilterId} onChange={onFilterChange} />
      ) : null}
    </View>
  );

  if (layout === "embedded") {
    return (
      <View style={styles.embedRoot} testID={testID}>
        {prependContent}
        {header}
        {isLoading && !data.length ? (
          <View style={styles.embedPad}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} />
            ))}
          </View>
        ) : data.length === 0 ? (
          listEmpty
        ) : (
          <>
            {visible.map((item) => (
              <EventListItem key={item.id} item={item} onPress={() => openItem(item)} />
            ))}
            {canLoadMore ? (
              <Pressable
                style={styles.moreBtn}
                onPress={() => setLimit((n) => Math.min(n + pageSize, data.length))}
              >
                <Text style={styles.moreTx}>{loadMoreLabel}</Text>
              </Pressable>
            ) : null}
          </>
        )}
        {selected && renderDetail ? (
          <BaseModal
            visible
            onClose={() => setSelected(null)}
            title={selected.title}
            sheetMaxHeight="88%"
          >
            {renderDetail(selected, { close: () => setSelected(null) })}
          </BaseModal>
        ) : null}
      </View>
    );
  }

  const listHeader = (
    <>
      {prependContent}
      {header}
    </>
  );

  return (
    <View style={styles.flatRoot} testID={testID}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={data.length === 0 ? listEmpty : null}
        ListFooterComponent={
          canLoadMore ? (
            <Pressable
              style={styles.moreBtn}
              onPress={() => setLimit((n) => Math.min(n + pageSize, data.length))}
            >
              <Text style={styles.moreTx}>{loadMoreLabel}</Text>
            </Pressable>
          ) : null
        }
        contentContainerStyle={styles.flatContent}
        style={{ backgroundColor: LIST_BG }}
        onEndReached={() => {
          if (canLoadMore) {
            setLimit((n) => Math.min(n + pageSize, data.length));
          }
        }}
        onEndReachedThreshold={0.35}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={mobileColors.accent} />
          ) : undefined
        }
      />
      {selected && renderDetail ? (
        <BaseModal
          visible
          onClose={() => setSelected(null)}
          title={selected.title}
          sheetMaxHeight="88%"
        >
          {renderDetail(selected, { close: () => setSelected(null) })}
        </BaseModal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flatRoot: { flex: 1, backgroundColor: LIST_BG },
  flatContent: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    flexGrow: 1,
    backgroundColor: LIST_BG
  },
  embedRoot: {
    backgroundColor: LIST_BG,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  embedPad: { paddingVertical: mobileSpacing.sm },
  headerBlock: { marginBottom: mobileSpacing.xs },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.xs
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    flex: 1
  },
  addTx: {
    fontSize: 22,
    fontWeight: "800",
    color: mobileColors.accent
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: mobileSpacing.xxl
  },
  emptyTx: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.lg
  },
  skelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  skelRow: { flexDirection: "row", alignItems: "center", gap: mobileSpacing.md },
  skelCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.surfaceMuted
  },
  skelLineLg: {
    height: 14,
    borderRadius: 6,
    backgroundColor: mobileColors.surfaceMuted,
    width: "70%"
  },
  skelLineSm: {
    height: 10,
    borderRadius: 5,
    backgroundColor: mobileColors.surfaceMuted,
    width: "50%"
  },
  moreBtn: {
    alignSelf: "center",
    paddingVertical: mobileSpacing.md
  },
  moreTx: { color: mobileColors.textSecondary, fontWeight: "700" }
});
