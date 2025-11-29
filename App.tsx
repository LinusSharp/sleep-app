import React, { useEffect, useState } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View, Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MySleepScreen } from "./src/screens/MySleepScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ClanScreen } from "./src/screens/ClanScreen";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./src/theme";

// --- IMPORT API CLIENT FOR FIX ---
import { apiGet, apiPost } from "./src/api/client";

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Custom Navigation Theme
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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 8,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === "MySleep") {
            iconName = focused ? "moon" : "moon-outline";
          } else if (route.name === "Friends") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "Leaderboard") {
            iconName = focused ? "trophy" : "trophy-outline";
          } else {
            iconName = focused ? "person" : "person-outline";
          }
          if (route.name === "Clan") {
            iconName = focused ? "shield" : "shield-outline";
          }

          return (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                shadowColor: focused ? theme.colors.primary : "transparent",
                shadowOpacity: 0.5,
                shadowRadius: 10,
              }}
            >
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

// --- GHOST USER FIX: Self-Healing Logic ---
async function ensureUserExistsInDb(session: Session) {
  if (!session?.user?.email) return;

  try {
    // 1. Try to fetch the profile
    await apiGet("/me/profile");
    // If successful, the user exists in Postgres. Do nothing.
  } catch (err) {
    // 2. If fetch fails (e.g. 404/500), assume the user is missing from DB.
    console.warn("User auth exists but DB row missing. Repairing...");

    try {
      // 3. Force creation of the user row
      await apiPost("/me/profile", { email: session.user.email });
      console.log("User DB row repaired successfully.");
    } catch (repairErr) {
      console.error("Critical: Failed to repair user DB row", repairErr);
      // Optional: Alert user if critical, or retry later
    }
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check Initial Session
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session ?? null);

      if (data.session) {
        // Run repair logic on boot if logged in
        await ensureUserExistsInDb(data.session);
      }

      setLoading(false);
    });

    // 2. Listen for Auth Changes (Login/Signup events)
    const { data } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);

        if (newSession) {
          // Run repair logic immediately after login/signup
          await ensureUserExistsInDb(newSession);
        }
      }
    );

    return () => {
      data.subscription.unsubscribe();
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
            <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <Stack.Screen name="Auth">{() => <LoginScreen />}</Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
