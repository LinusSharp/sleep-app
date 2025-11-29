import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage"; // <--- Import
import { supabase } from "../lib/supabase";
import { theme } from "../theme";
import { apiPost } from "../api/client";

const EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PRIVACY_URL = "https://linus-sharp.co.uk/privacy-policy/";

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }
    setLoading(true);

    try {
      if (mode === "login") {
        // --- LOGIN FLOW ---
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          Alert.alert("Login failed", error.message);
        } else if (data.user) {
          // --- FLAG FOR ONBOARDING ---
          await AsyncStorage.setItem("JUST_LOGGED_IN", "true");

          try {
            await apiPost("/me/profile", { email: data.user.email });
          } catch (e) {
            console.log("Profile sync warning:", e);
          }
        }
      } else {
        // --- SIGNUP FLOW ---
        const { error, data } = await supabase.auth.signUp({ email, password });

        if (error) {
          Alert.alert("Error", error.message);
        } else {
          // --- FLAG FOR ONBOARDING ---
          if (data.user) {
            await AsyncStorage.setItem("JUST_LOGGED_IN", "true");
            try {
              await apiPost("/me/profile", { email: data.user.email });
            } catch (e) {
              console.log("Profile sync warning:", e);
            }
          }
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.hero}>
          <View style={styles.iconPlaceholder}>
            <Text style={{ fontSize: 40 }}>☾</Text>
          </View>
          <Text style={styles.appName}>SlumberLeague</Text>
          <Text style={styles.tagline}>Compete. Sleep. Win.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.toggleContainer}>
            <Pressable
              style={[
                styles.toggleBtn,
                mode === "login" && styles.toggleBtnActive,
              ]}
              onPress={() => setMode("login")}
            >
              <Text
                style={[
                  styles.toggleText,
                  mode === "login" && styles.toggleTextActive,
                ]}
              >
                Log In
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleBtn,
                mode === "signup" && styles.toggleBtnActive,
              ]}
              onPress={() => setMode("signup")}
            >
              <Text
                style={[
                  styles.toggleText,
                  mode === "signup" && styles.toggleTextActive,
                ]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="sleeper@example.com"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textTertiary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.mainBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.mainBtnText}>
              {loading
                ? "Loading..."
                : mode === "login"
                ? "Enter the League"
                : "Join the League"}
            </Text>
          </Pressable>

          {/* APPLE COMPLIANCE: Guideline 1.2 - EULA Agreement */}
          {mode === "signup" && (
            <Text style={styles.legalText}>
              By joining, you agree to our{" "}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(EULA_URL)}
              >
                Terms of Use (EULA)
              </Text>{" "}
              and{" "}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL(PRIVACY_URL)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 40,
  },
  iconPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  form: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.surfaceHighlight,
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: theme.colors.textPrimary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 16,
  },
  mainBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  mainBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  legalText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 18,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
});
