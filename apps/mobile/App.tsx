import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { SessionProvider } from "./src/context/SessionContext";
import { isAuthEnvConfigured } from "./src/env";
import { getSupabase } from "./src/lib/supabase";
import { FarmDetailScreen } from "./src/screens/FarmDetailScreen";
import { FarmListScreen } from "./src/screens/FarmListScreen";
import { LoginGateScreen } from "./src/screens/LoginGateScreen";
import type { RootStackParamList } from "./src/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f9f8ea",
    primary: "#5d7a1f"
  }
};

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#5d7a1f" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#f9f8ea" }
      }}
    >
      <Stack.Screen
        name="FarmList"
        component={FarmListScreen}
        options={{ title: "Mes fermes" }}
      />
      <Stack.Screen
        name="FarmDetail"
        component={FarmDetailScreen}
        options={({ route }) => ({ title: route.params.farmName })}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const authConfigured = isAuthEnvConfigured();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      return;
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const inMainNav = Boolean(authConfigured && session);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style={inMainNav ? "light" : "dark"} />
        {authConfigured && session === undefined ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#5d7a1f" />
          </View>
        ) : authConfigured && session ? (
          <SessionProvider
            accessToken={session.access_token}
            signOut={signOut}
          >
            <NavigationContainer theme={navTheme}>
              <MainStack />
            </NavigationContainer>
          </SessionProvider>
        ) : (
          <LoginGateScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f8ea"
  }
});
