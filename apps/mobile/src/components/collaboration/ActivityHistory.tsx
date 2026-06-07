import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import type { FarmMemberDto, MemberActivityLogDto } from "../../lib/api";
import { fetchFarmActivityLogs } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ActivityToggleHeader } from "./ActivityToggleHeader";
import { MemberAvatar } from "./MemberAvatar";

const COLLAPSED_COUNT = 3;

const MODULE_COLORS: Record<string, string> = {
  cheptel: "#1C7ED6",
  health: "#2F9E44",
  finance: "#F59F00",
  stock: "#E8590C",
  gestation: "#7E3FF2",
  collaboration: "#868E96"
};

const ACTION_LABEL_FR: Record<string, string> = {
  permissions_updated: "Permissions modifiées",
  member_joined: "A rejoint la ferme",
  member_removed: "Accès révoqué",
  invitation_sent: "Invitation envoyée",
  livestock_created: "Animal / bande ajouté",
  livestock_updated: "Cheptel mis à jour",
  health_event: "Événement santé",
  finance_entry: "Saisie finance"
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

type Props = {
  farmId: string;
  members: FarmMemberDto[];
};

export function ActivityHistory({ farmId, members }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [expanded, setExpanded] = useState(false);
  const [filterMemberId, setFilterMemberId] = useState<string | undefined>();

  const logsQ = useInfiniteQuery({
    queryKey: ["farmActivityLogs", farmId, filterMemberId, activeProfileId],
    queryFn: ({ pageParam }) =>
      fetchFarmActivityLogs(accessToken, farmId, {
        memberId: filterMemberId,
        cursor: pageParam as string | undefined,
        limit: 30,
        activeProfileId
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor
  });

  const allItems: MemberActivityLogDto[] = (
    logsQ.data?.pages ?? []
  ).flatMap((p) => p.items);

  const visibleItems = expanded ? allItems : allItems.slice(0, COLLAPSED_COUNT);

  const loadMore = useCallback(() => {
    if (logsQ.hasNextPage && !logsQ.isFetchingNextPage) {
      void logsQ.fetchNextPage();
    }
  }, [logsQ]);

  return (
    <View style={styles.wrap}>
      <ActivityToggleHeader
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={t("collab.historyTitle")}
      />

      {expanded ? (
        <>
          {/* Filtre membres pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            <Pressable
              onPress={() => setFilterMemberId(undefined)}
              style={[styles.pill, !filterMemberId && styles.pillActive]}
            >
              <Text
                style={[
                  styles.pillTxt,
                  !filterMemberId && styles.pillTxtActive
                ]}
              >
                {t("collab.filterAll")}
              </Text>
            </Pressable>
            {members.map((m) => {
              const name =
                m.user.fullName?.trim() || m.user.email || m.userId;
              const active = filterMemberId === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() =>
                    setFilterMemberId(active ? undefined : m.id)
                  }
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text
                    style={[styles.pillTxt, active && styles.pillTxtActive]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {logsQ.isLoading ? (
        <ActivityIndicator
          color={mobileColors.accent}
          style={styles.loader}
        />
      ) : allItems.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyTxt}>{t("collab.historyEmpty")}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => <ActivityItem item={item} />}
          onEndReached={expanded ? loadMore : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            logsQ.isFetchingNextPage ? (
              <ActivityIndicator color={mobileColors.accent} />
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {!expanded && allItems.length > COLLAPSED_COUNT ? (
        <Pressable
          onPress={() => setExpanded(true)}
          style={styles.showMoreBtn}
        >
          <Text style={styles.showMoreTxt}>{t("collab.historyShowMore")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActivityItem({ item }: { item: MemberActivityLogDto }) {
  const memberName =
    item.member.user.fullName?.trim() ||
    item.member.user.email ||
    "—";
  const modColor = MODULE_COLORS[item.module] ?? mobileColors.textSecondary;
  const actionLabel = ACTION_LABEL_FR[item.action] ?? item.action;

  return (
    <View style={itemStyles.row}>
      <MemberAvatar name={memberName} size={36} />
      <View style={itemStyles.body}>
        <Text style={itemStyles.action} numberOfLines={1}>
          {actionLabel}
        </Text>
        <Text style={itemStyles.who} numberOfLines={1}>
          {memberName}
        </Text>
      </View>
      <View style={itemStyles.right}>
        <View
          style={[itemStyles.modTag, { backgroundColor: `${modColor}22` }]}
        >
          <Text style={[itemStyles.modTxt, { color: modColor }]}>
            {item.module}
          </Text>
        </View>
        <Text style={itemStyles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm
  },
  pillsRow: {
    flexDirection: "row",
    gap: mobileSpacing.xs,
    paddingVertical: mobileSpacing.xs
  },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  pillActive: {
    backgroundColor: mobileColors.accentSoft,
    borderColor: mobileColors.accent
  },
  pillTxt: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  pillTxtActive: {
    color: mobileColors.accent
  },
  loader: {
    marginVertical: mobileSpacing.lg
  },
  emptyRow: {
    paddingVertical: mobileSpacing.md
  },
  emptyTxt: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  listContent: {
    gap: mobileSpacing.xs
  },
  showMoreBtn: {
    alignItems: "center",
    paddingVertical: mobileSpacing.sm
  },
  showMoreTxt: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  }
});

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  body: {
    flex: 1,
    gap: 2
  },
  action: {
    ...mobileTypography.body,
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  who: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  right: {
    alignItems: "flex-end",
    gap: 4
  },
  modTag: {
    paddingHorizontal: mobileSpacing.xs,
    paddingVertical: 2,
    borderRadius: mobileRadius.sm
  },
  modTxt: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  date: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.textSecondary
  }
});
