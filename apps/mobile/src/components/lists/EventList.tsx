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
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { BaseModal } from "../modals/BaseModal";
import { EventListFilter } from "./EventListFilter";
import { EventListItem } from "./EventListItem";
import type { EventItem, FilterPill } from "./types";
import { EmptyStateCard } from "../common/EmptyStateCard";
import { ListItemSkeleton } from "../common/SkeletonBlocks";
import { ScreenSection } from "../layout/ScreenSection";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

const LIST_BG = uiNamedColors.cF5F5F5;

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
  /** Swipe droite (ex. modifier) — retourner null pour désactiver sur un item */
  renderSwipeRight?: (item: EventItem) => ReactNode | null;
  /** Ouvre le détail d’un enregistrement (navigation depuis alerte). */
  initialOpenItemId?: string;
};

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
  testID,
  renderSwipeRight,
  initialOpenItemId
}: EventListProps) {
  const [limit, setLimit] = useState(pageSize);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [didOpenInitial, setDidOpenInitial] = useState(false);

  useEffect(() => {
    setLimit(pageSize);
  }, [data, pageSize]);

  useEffect(() => {
    if (!initialOpenItemId || didOpenInitial || isLoading || !data.length) {
      return;
    }
    const item = data.find((d) => d.id === initialOpenItemId);
    if (item) {
      onItemPress?.(item);
      if (renderDetail) {
        setSelected(item);
      }
      setDidOpenInitial(true);
    }
  }, [
    initialOpenItemId,
    didOpenInitial,
    isLoading,
    data,
    onItemPress,
    renderDetail
  ]);

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

  const renderListItem = useCallback(
    (item: EventItem) => {
      const row = (
        <EventListItem item={item} onPress={() => openItem(item)} />
      );
      const swipe = renderSwipeRight?.(item);
      if (!swipe) {
        return row;
      }
      return (
        <Swipeable renderRightActions={() => swipe} overshootRight={false}>
          {row}
        </Swipeable>
      );
    },
    [openItem, renderSwipeRight]
  );

  const renderRow: ListRenderItem<EventItem> = useCallback(
    ({ item }) => renderListItem(item),
    [renderListItem]
  );

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.embedPad}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ListItemSkeleton key={i} />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <EmptyStateCard title={emptyMessage || undefined} />
      </View>
    );
  }, [isLoading, emptyMessage]);

  const filterRow =
    filters.length > 0 && activeFilterId && onFilterChange ? (
      <EventListFilter pills={filters} activeId={activeFilterId} onChange={onFilterChange} />
    ) : null;

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
      {filterRow}
    </View>
  );

  if (layout === "embedded") {
    const listBody = (
      <>
        {prependContent}
        {!sectionTitle ? header : filterRow ? <View style={styles.headerBlock}>{filterRow}</View> : null}
        {isLoading && !data.length ? (
          <View style={styles.embedPad}>
            {Array.from({ length: 5 }).map((_, i) => (
              <ListItemSkeleton key={i} />
            ))}
          </View>
        ) : data.length === 0 ? (
          listEmpty
        ) : (
          <>
            {visible.map((item) => (
              <View key={item.id}>{renderListItem(item)}</View>
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
      </>
    );

    const modal =
      selected && renderDetail ? (
        <BaseModal
          visible
          onClose={() => setSelected(null)}
          title={selected.title}
          sheetMaxHeight="88%"
        >
          {renderDetail(selected, { close: () => setSelected(null) })}
        </BaseModal>
      ) : null;

    if (sectionTitle) {
      return (
        <ScreenSection
          title={sectionTitle}
          headerRight={
            <View style={styles.sectionRow}>
              {sectionRight}
              {onAddPress ? (
                <Pressable onPress={onAddPress} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.addTx}>＋</Text>
                </Pressable>
              ) : null}
            </View>
          }
        >
          {listBody}
          {modal}
        </ScreenSection>
      );
    }

    return (
      <View style={styles.embedRoot} testID={testID}>
        {listBody}
        {modal}
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
    gap: mobileSpacing.sm
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
    fontSize: mobileFontSize.xl,
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
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  skelRow: { flexDirection: "row", alignItems: "center", gap: mobileSpacing.md },
  skelCircle: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.surfaceMuted
  },
  skelLineLg: {
    height: 14,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.surfaceMuted,
    width: "70%"
  },
  skelLineSm: {
    height: 10,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.surfaceMuted,
    width: "50%"
  },
  moreBtn: {
    alignSelf: "center",
    paddingVertical: mobileSpacing.md
  },
  moreTx: { color: mobileColors.textSecondary, fontWeight: "700" }
});
