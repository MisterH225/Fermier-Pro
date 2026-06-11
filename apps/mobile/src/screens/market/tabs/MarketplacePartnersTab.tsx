import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyStateCard } from "../../../components/common/EmptyStateCard";
import { useSession } from "../../../context/SessionContext";
import {
  ensureDirectChatRoom,
  fetchMarketplacePartners,
  type MarketplacePartnerDto
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { buyerColors } from "../../../theme/buyerTheme";
import type { RootStackParamList } from "../../../types/navigation";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  role: "seller" | "buyer";
  buyerView?: boolean;
  contentPaddingBottom: number;
};

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function PartnerRow({
  item,
  buyerView,
  onMessage
}: {
  item: MarketplacePartnerDto;
  buyerView?: boolean;
  onMessage: () => void;
}) {
  const { t } = useTranslation();
  const accent = buyerView ? buyerColors.primary : mobileColors.accent;

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, buyerView && { backgroundColor: buyerColors.primaryLight }]}>
        <Text style={[styles.avatarText, buyerView && { color: buyerColors.primary }]}>
          {item.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.displayName}
        </Text>
        {item.subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
        <Text style={styles.rowMeta}>
          {t("marketScreen.partners.transactionCount", {
            count: item.transactionCount
          })}
          {item.closedCount > 0
            ? ` · ${t("marketScreen.partners.closedCount", { count: item.closedCount })}`
            : ""}
          {" · "}
          {formatRelativeDate(item.lastTransactionAt)}
        </Text>
      </View>
      <Pressable
        onPress={onMessage}
        style={[styles.messageBtn, { borderColor: accent }]}
        accessibilityRole="button"
        accessibilityLabel={t("marketScreen.partners.message")}
      >
        <Ionicons name="chatbubble-outline" size={18} color={accent} />
      </Pressable>
    </View>
  );
}

export function MarketplacePartnersTab({
  navigation,
  role,
  buyerView,
  contentPaddingBottom
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();

  const partnersQ = useQuery({
    queryKey: ["marketplacePartners", activeProfileId, role],
    queryFn: () =>
      fetchMarketplacePartners(accessToken!, role, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const openChat = async (partner: MarketplacePartnerDto) => {
    try {
      const room = await ensureDirectChatRoom(
        accessToken!,
        partner.userId,
        activeProfileId
      );
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        headline: partner.displayName,
        peerUserId: partner.userId
      });
    } catch (e) {
      Alert.alert(
        t("marketScreen.partners.messageErrorTitle"),
        e instanceof Error ? e.message : t("common.error")
      );
    }
  };

  if (partnersQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          color={buyerView ? buyerColors.primary : mobileColors.accent}
        />
      </View>
    );
  }

  if (partnersQ.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t("common.error")}</Text>
      </View>
    );
  }

  const items = partnersQ.data ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.userId}
      contentContainerStyle={[
        styles.listContent,
        items.length === 0 && styles.listContentEmpty,
        { paddingBottom: contentPaddingBottom }
      ]}
      refreshControl={
        <RefreshControl
          refreshing={partnersQ.isFetching && !partnersQ.isPending}
          onRefresh={() => void partnersQ.refetch()}
          tintColor={buyerView ? buyerColors.primary : mobileColors.accent}
        />
      }
      ListEmptyComponent={
        <EmptyStateCard
          title={t(
            role === "seller"
              ? "marketScreen.partners.emptyClientsTitle"
              : "marketScreen.partners.emptySuppliersTitle"
          )}
          subtitle={t(
            role === "seller"
              ? "marketScreen.partners.emptyClientsBody"
              : "marketScreen.partners.emptySuppliersBody"
          )}
        />
      }
      renderItem={({ item }) => (
        <PartnerRow
          item={item}
          buyerView={buyerView}
          onMessage={() => void openChat(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg
  },
  errorText: {
    ...mobileTypography.body,
    color: mobileColors.error
  },
  listContent: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    ...mobileTypography.cardTitle,
    color: mobileColors.accent
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  rowTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  rowSubtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  rowMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
