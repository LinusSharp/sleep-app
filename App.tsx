import React, { useEffect, useState } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MySleepScreen } from "./src/screens/MySleepScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ClanScreen } from "./src/screens/ClanScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./src/theme";
import { apiGet, apiPost } from "./src/api/client";

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.primary,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 80,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 8 },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === "MySleep")
            iconName = focused ? "moon" : "moon-outline";
          else if (route.name === "Friends")
            iconName = focused ? "people" : "people-outline";
          else if (route.name === "Leaderboard")
            iconName = focused ? "trophy" : "trophy-outline";
          else if (route.name === "Clan")
            iconName = focused ? "shield" : "shield-outline";
          else iconName = focused ? "person" : "person-outline";

          return (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={iconName} size={size} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="MySleep"
        component={MySleepScreen}
        options={{ title: "Sleep" }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ title: "Friends" }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: "League" }}
      />
      <Tab.Screen
        name="Clan"
        component={ClanScreen}
        options={{ title: "Clan" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
}

// Self-Healing Logic (Run in background)
async function ensureUserExistsInDb(session: Session) {
  if (!session?.user?.email) return;
  try {
    await apiGet("/me/profile");
  } catch (err) {
    console.warn("User auth exists but DB row missing. Repairing...");
    try {
      await apiPost("/me/profile", { email: session.user.email });
      console.log("User DB row repaired successfully.");
    } catch (repairErr) {
      console.error("Critical: Failed to repair user DB row", repairErr);
    }
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const completeOnboarding = async () => {
    await AsyncStorage.removeItem("JUST_LOGGED_IN");
    setShowOnboarding(false);
  };

  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      try {
        // 1. Get Supabase Session
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSession(data.session);

          if (data.session) {
            // 2. Check Onboarding Flag (Fast, wait for this)
            const justLoggedIn = await AsyncStorage.getItem("JUST_LOGGED_IN");
            if (justLoggedIn === "true") {
              setShowOnboarding(true);
            }

            // 3. Check DB Integrity (Slow, run in background - DO NOT AWAIT)
            ensureUserExistsInDb(data.session);
          }
        }
      } catch (err) {
        console.log("Session Check Error:", err);
        // If critical auth error, ensure we are logged out
        if (mounted) {
          setSession(null);
          await supabase.auth.signOut();
        }
      } finally {
        // 4. Always stop loading
        if (mounted) setLoading(false);
      }
    };

    initializeApp();

    // 5. Auth Listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth Event:", event);

        // FIX: Removed the invalid "TOKEN_REFRESHED_NOT_POSSIBLE" string
        if (event === "SIGNED_OUT") {
          setSession(null);
          setLoading(false); // Ensure loading stops if we get kicked out
        } else if (newSession) {
          setSession(newSession);

          // Re-check onboarding on login events
          if (event === "SIGNED_IN") {
            const justLoggedIn = await AsyncStorage.getItem("JUST_LOGGED_IN");
            if (justLoggedIn === "true") setShowOnboarding(true);
            ensureUserExistsInDb(newSession);
          }
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <NavigationContainer theme={NavTheme}>
        <StatusBar style="light" backgroundColor={theme.colors.background} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            showOnboarding ? (
              <Stack.Screen name="Onboarding">
                {(props) => (
                  <OnboardingScreen {...props} onFinish={completeOnboarding} />
                )}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Main" component={MainTabs} />
            )
          ) : (
            <Stack.Screen name="Auth">{() => <LoginScreen />}</Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
