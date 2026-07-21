import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps
} from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SurfaceCard } from "../components/common/SurfaceCard";
import { producerPalette } from "../components/common/rolePalette";
import { ProducerPendingMarketplaceBanner } from "../components/producer/ProducerPendingMarketplaceBanner";
import {
  ProfilePickerModal,
  ProfileSwitcherButton
} from "../components/ProfilePickerModal";
import { useSession } from "../context/SessionContext";
import {
  buildFarmListEmptyRows,
  buildFarmListHeaderSecondaryItems,
  buildFarmListListHeaderRows,
  navigateFarmListQuickNav
} from "../features/farm-list-menu";
import type { FarmDto } from "../lib/api";
import { fetchFarms } from "../lib/api";
import { farmDetailMenuVisibility } from "../lib/menuVisibility";
import { mobileColors, mobileRadius, mobileSpacing, mobileFontSize } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

const PRODUCER = "producer";

type Props = NativeStackScreenProps<RootStackParamList, "FarmList">;

export function FarmListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const stackNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    accessToken,
    signOut,
    authLoading,
    authError,
    authMe,
    activeProfileId,
    setActiveProfileId,
    clientFeatures
  } = useSession();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const menuFlags = farmDetailMenuVisibility(clientFeatures);
  const headerSecondaryItems = buildFarmListHeaderSecondaryItems(menuFlags, t);

  const farmsQuery = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken, activeProfileId),
    enabled: !authLoading
  });

  const profiles = authMe?.profiles ?? [];
  const producerProfile = profiles.find((p) => p.type === PRODUCER);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () =>
        profiles.length > 0 ? (
          <ProfileSwitcherButton
            profiles={profiles}
            activeProfileId={activeProfileId}
            onOpen={() => setProfileModalOpen(true)}
          />
        ) : null,
      headerRight: () => (
        <View style={styles.headerRight}>
          {headerSecondaryItems
            .filter((item) => item.visible)
            .map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() =>
                  navigateFarmListQuickNav(stackNavigation, {
                    screen: item.screen,
                    ...(item.screen === "MarketplaceList"
                      ? { tab: "offers" as const, offersSubTab: "received" as const }
                      : {})
                  })
                }
                style={styles.headerSecondary}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.headerSecondaryText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          {producerProfile ? (
            <TouchableOpacity
              onPress={() =>
                navigateFarmListQuickNav(stackNavigation, {
                  screen: "CreateFarm"
                })
              }
              style={styles.headerSecondary}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.headerSecondaryText}>
                {t("farmListScreen.addFarm")}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => void signOut()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnText}>{t("farmListScreen.signOut")}</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [
    navigation,
    signOut,
    profiles,
    activeProfileId,
    producerProfile,
    stackNavigation,
    menuFlags.marketplace,
    menuFlags.chat,
    t
  ]);

  const displayError = authError || farmsQuery.error;

  const profileModal =
    profiles.length > 0 ? (
      <ProfilePickerModal
        visible={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onSelect={(id) => void setActiveProfileId(id)}
      />
    ) : null;

  if (displayError) {
    const msg =
      typeof displayError === "string"
        ? displayError
        : displayError instanceof Error
          ? displayError.message
          : String(displayError);
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{msg}</Text>
        <Text style={styles.hint}>{t("farmListScreen.apiHint")}</Text>
      </View>
    );
  }

  if (authLoading || farmsQuery.isPending) {
    return (
      <>
        {profileModal}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={mobileColors.accent} />
          {authMe?.user.fullName ? (
            <Text style={styles.welcome}>
              {t("farmListScreen.welcome", { name: authMe.user.fullName })}
            </Text>
          ) : null}
        </View>
      </>
    );
  }

  const farms = farmsQuery.data ?? [];

  if (farms.length === 0) {
    const emptyRows = buildFarmListEmptyRows(
      {
        menu: menuFlags,
        hasProducerProfile: Boolean(producerProfile)
      },
      t
    );

    return (
      <>
        {profileModal}
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{t("farmListScreen.emptyTitle")}</Text>
          <Text style={styles.emptySub}>{t("farmListScreen.emptySub")}</Text>
          {emptyRows
            .filter((row) => row.visible)
            .map((row) => {
              if (row.kind === "marketplaceCta") {
                return (
                  <TouchableOpacity
                    key={row.kind}
                    style={styles.ctaOutline}
                    onPress={() =>
                      navigateFarmListQuickNav(stackNavigation, row.target)
                    }
                  >
                    <Text style={styles.ctaOutlineText}>{row.title}</Text>
                  </TouchableOpacity>
                );
              }
              if (row.kind === "createFarmCta") {
                return (
                  <TouchableOpacity
                    key={row.kind}
                    style={styles.cta}
                    onPress={() =>
                      navigateFarmListQuickNav(stackNavigation, row.target)
                    }
                  >
                    <Text style={styles.ctaText}>{row.title}</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={row.kind}
                  style={styles.inviteLinkEmpty}
                  onPress={() =>
                    navigateFarmListQuickNav(stackNavigation, row.target)
                  }
                >
                  <Text style={styles.inviteLinkText}>{row.title}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </>
    );
  }

  const listHeaderRows = buildFarmListListHeaderRows(
    {
      menu: menuFlags,
      hasProducerProfile: Boolean(producerProfile)
    },
    t
  );

  return (
    <>
      {profileModal}
      <FlatList
        data={farms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {authMe?.user.fullName ? (
              <Text style={styles.listWelcome}>
                {t("farmListScreen.welcome", { name: authMe.user.fullName })}
              </Text>
            ) : null}
            {menuFlags.marketplace ? (
              <ProducerPendingMarketplaceBanner
                style={{ marginHorizontal: mobileSpacing.lg }}
              />
            ) : null}
            {listHeaderRows
              .filter((row) => row.visible)
              .map((row) => {
                if (row.kind === "marketplaceBanner") {
                  return (
                    <TouchableOpacity
                      key={row.kind}
                      style={styles.marketInline}
                      onPress={() =>
                        navigateFarmListQuickNav(stackNavigation, row.target)
                      }
                    >
                      <Text style={styles.marketInlineText}>{row.title}</Text>
                      <Text style={styles.marketInlineSub}>{row.subtitle}</Text>
                    </TouchableOpacity>
                  );
                }
                if (row.kind === "createFarm") {
                  return (
                    <TouchableOpacity
                      key={row.kind}
                      style={styles.inlineCta}
                      onPress={() =>
                        navigateFarmListQuickNav(stackNavigation, row.target)
                      }
                    >
                      <Text style={styles.inlineCtaText}>{row.title}</Text>
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={row.kind}
                    style={styles.inviteLink}
                    onPress={() =>
                      navigateFarmListQuickNav(stackNavigation, row.target)
                    }
                  >
                    <Text style={styles.inviteLinkText}>{row.title}</Text>
                  </TouchableOpacity>
                );
              })}
          </>
        }
        renderItem={({ item }) => (
          <SurfaceCard
            palette={producerPalette}
            onPress={() =>
              navigation.navigate("FarmDetail", {
                farmId: item.id,
                farmName: item.name
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {t("farmListScreen.cardMode", {
                species: item.speciesFocus,
                mode: item.livestockMode
              })}
            </Text>
            {item.address ? (
              <Text style={styles.cardAddr} numberOfLines={2}>
                {item.address}
              </Text>
            ) : null}
          </SurfaceCard>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: mobileSpacing.lg,
    paddingBottom: 32,
    backgroundColor: mobileColors.canvas
  },
  listWelcome: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    marginBottom: 10
  },
  marketInline: {
    alignSelf: "stretch",
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  marketInlineText: {
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  marketInlineSub: {
    marginTop: 4,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  },
  inlineCta: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.accent
  },
  inlineCtaText: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: mobileFontSize.md
  },
  inviteLink: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingVertical: 6
  },
  inviteLinkEmpty: {
    marginTop: 16,
    paddingVertical: 8
  },
  inviteLinkText: {
    fontSize: mobileFontSize.md,
    color: mobileColors.accent,
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  welcome: {
    marginTop: 16,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary
  },
  cardTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  cardSub: {
    marginTop: 6,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary
  },
  cardAddr: {
    marginTop: 8,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textTertiary
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  errorText: {
    color: mobileColors.error,
    textAlign: "center",
    fontSize: mobileFontSize.md
  },
  hint: {
    marginTop: 12,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  emptyTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  emptySub: {
    marginTop: 10,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 20
  },
  ctaOutline: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: mobileRadius.lg,
    alignSelf: "stretch"
  },
  ctaOutlineText: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.lg,
    textAlign: "center"
  },
  cta: {
    marginTop: 12,
    backgroundColor: mobileColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: mobileRadius.lg,
    alignSelf: "stretch"
  },
  ctaText: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: mobileFontSize.lg
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerSecondary: {
    paddingHorizontal: 4,
    marginRight: 10
  },
  headerSecondaryText: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: mobileFontSize.md
  },
  headerBtn: {
    paddingHorizontal: 4
  },
  headerBtnText: {
    color: mobileColors.textSecondary,
    fontWeight: "600",
    fontSize: mobileFontSize.md
  }
});
