import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { SessionProvider } from "./src/context/SessionContext";
import { isAuthEnvConfigured } from "./src/env";
import { queryClient } from "./src/lib/queryClient";
import { getSupabase } from "./src/lib/supabase";
import { AnimalDetailScreen } from "./src/screens/AnimalDetailScreen";
import { BatchDetailScreen } from "./src/screens/BatchDetailScreen";
import { CreateFarmScreen } from "./src/screens/CreateFarmScreen";
import { CreateTaskScreen } from "./src/screens/CreateTaskScreen";
import { FarmDetailScreen } from "./src/screens/FarmDetailScreen";
import { FarmListScreen } from "./src/screens/FarmListScreen";
import { FarmLivestockScreen } from "./src/screens/FarmLivestockScreen";
import { FarmTasksScreen } from "./src/screens/FarmTasksScreen";
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
      <Stack.Screen
        name="FarmLivestock"
        component={FarmLivestockScreen}
        options={{ title: "Cheptel" }}
      />
      <Stack.Screen
        name="FarmTasks"
        component={FarmTasksScreen}
        options={{ title: "Tâches terrain" }}
      />
      <Stack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{ title: "Nouvelle tâche" }}
      />
      <Stack.Screen
        name="CreateFarm"
        component={CreateFarmScreen}
        options={{ title: "Nouvelle ferme" }}
      />
      <Stack.Screen
        name="AnimalDetail"
        component={AnimalDetailScreen}
        options={({ route }) => ({ title: route.params.headline })}
      />
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
        options={({ route }) => ({ title: route.params.batchName })}
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
            <QueryClientProvider client={queryClient}>
              <NavigationContainer theme={navTheme}>
                <MainStack />
              </NavigationContainer>
            </QueryClientProvider>
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
