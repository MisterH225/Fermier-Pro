import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps
} from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
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
import { mobileColors, mobileRadius, mobileSpacing } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

const PRODUCER = "producer";

type Props = NativeStackScreenProps<RootStackParamList, "FarmList">;

export function FarmListScreen({ navigation }: Props) {
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
  const headerSecondaryItems =
    buildFarmListHeaderSecondaryItems(menuFlags);

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
                    screen: item.screen
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
              <Text style={styles.headerSecondaryText}>+ Ferme</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => void signOut()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={styles.headerBtnText}>Déconnexion</Text>
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
    menuFlags.chat
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
        <Text style={styles.hint}>
          Vérifie EXPO_PUBLIC_API_URL (émulateur : souvent http://10.0.2.2:3000).
        </Text>
      </View>
    );
  }

  if (authLoading || farmsQuery.isPending) {
    return (
      <>
        {profileModal}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5d7a1f" />
          {authMe?.user.fullName ? (
            <Text style={styles.welcome}>
              Bonjour {authMe.user.fullName}
            </Text>
          ) : null}
        </View>
      </>
    );
  }

  const farms = farmsQuery.data ?? [];

  if (farms.length === 0) {
    const emptyRows = buildFarmListEmptyRows({
      menu: menuFlags,
      hasProducerProfile: Boolean(producerProfile)
    });

    return (
      <>
        {profileModal}
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Aucune ferme</Text>
          <Text style={styles.emptySub}>
            Crée une ferme avec le bouton « + Ferme » (profil producteur), ou
            depuis un client API POST /farms. Tu peux aussi parcourir le marché.
          </Text>
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

  const listHeaderRows = buildFarmListListHeaderRows({
    menu: menuFlags,
    hasProducerProfile: Boolean(producerProfile)
  });

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
                Bonjour {authMe.user.fullName}
              </Text>
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
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("FarmDetail", {
                farmId: item.id,
                farmName: item.name
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {item.speciesFocus} · mode {item.livestockMode}
            </Text>
            {item.address ? (
              <Text style={styles.cardAddr} numberOfLines={2}>
                {item.address}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: mobileSpacing.lg,
    paddingBottom: 32,
    backgroundColor: mobileColors.surface
  },
  listWelcome: {
    fontSize: 15,
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
    fontSize: 16,
    fontWeight: "700"
  },
  marketInlineSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#6d745b"
  },
  inlineCta: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: mobileColors.accent
  },
  inlineCtaText: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: 14
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
    fontSize: 15,
    color: mobileColors.accent,
    fontWeight: "600",
    textDecorationLine: "underline"
  },
  welcome: {
    marginTop: 16,
    fontSize: 15,
    color: "#6d745b"
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    color: "#6d745b"
  },
  cardAddr: {
    marginTop: 8,
    fontSize: 13,
    color: "#4b513d"
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
    fontSize: 14
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    color: "#6d745b",
    textAlign: "center"
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  emptySub: {
    marginTop: 10,
    fontSize: 14,
    color: "#6d745b",
    textAlign: "center",
    lineHeight: 20
  },
  ctaOutline: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignSelf: "stretch"
  },
  ctaOutlineText: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center"
  },
  cta: {
    marginTop: 12,
    backgroundColor: mobileColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignSelf: "stretch"
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
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
    fontSize: 14
  },
  headerBtn: {
    paddingHorizontal: 4
  },
  headerBtnText: {
    color: mobileColors.textSecondary,
    fontWeight: "600",
    fontSize: 15
  }
});
