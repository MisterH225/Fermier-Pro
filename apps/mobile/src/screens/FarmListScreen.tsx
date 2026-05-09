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
import type { FarmDto } from "../lib/api";
import { fetchFarms } from "../lib/api";
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
    setActiveProfileId
  } = useSession();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

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
          {producerProfile ? (
            <TouchableOpacity
              onPress={() => stackNavigation.navigate("CreateFarm")}
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
    stackNavigation
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
    return (
      <>
        {profileModal}
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Aucune ferme</Text>
          <Text style={styles.emptySub}>
            Crée une ferme avec le bouton « + Ferme » (profil producteur), ou
            depuis un client API POST /farms.
          </Text>
          {producerProfile ? (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => stackNavigation.navigate("CreateFarm")}
            >
              <Text style={styles.ctaText}>Créer une ferme</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </>
    );
  }

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
            {producerProfile ? (
              <TouchableOpacity
                style={styles.inlineCta}
                onPress={() => stackNavigation.navigate("CreateFarm")}
              >
                <Text style={styles.inlineCtaText}>+ Nouvelle ferme</Text>
              </TouchableOpacity>
            ) : null}
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
    padding: 16,
    paddingBottom: 32
  },
  listWelcome: {
    fontSize: 15,
    color: "#4b513d",
    marginBottom: 10
  },
  inlineCta: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e8efd9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#5d7a1f"
  },
  inlineCtaText: {
    color: "#3d5218",
    fontWeight: "600",
    fontSize: 14
  },
  welcome: {
    marginTop: 16,
    fontSize: 15,
    color: "#6d745b"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2910"
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
    color: "#b00020",
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
    color: "#1f2910"
  },
  emptySub: {
    marginTop: 10,
    fontSize: 14,
    color: "#6d745b",
    textAlign: "center",
    lineHeight: 20
  },
  cta: {
    marginTop: 20,
    backgroundColor: "#5d7a1f",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14
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
    color: "#fff",
    fontWeight: "600",
    fontSize: 14
  },
  headerBtn: {
    paddingHorizontal: 4
  },
  headerBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15
  }
});
