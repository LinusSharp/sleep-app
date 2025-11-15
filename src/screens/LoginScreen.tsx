import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";

// --- Light theme design tokens ---
const colors = {
  background: "#F4F5FB", // app background
  surface: "#FFFFFF", // cards
  surfaceMuted: "#EEF1FF", // inputs / subtle fills
  primary: "#1E2554", // main brand color
  primaryLight: "#3C4AA8",
  accent: "#FFB347",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  border: "#D0D4E6",
  error: "#E53935",
};

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      Alert.alert("Login failed", error.message);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert("Check your email", "Confirm your address then log in.");
    }
  }

  const submit = mode === "login" ? handleLogin : handleSignUp;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>Sleep League</Text>
          <Text style={styles.tagline}>
            Track your sleep. Compete with friends.
          </Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.toggleBox}>
          <Pressable
            style={[styles.toggleBtn, mode === "login" && styles.toggleActive]}
            onPress={() => setMode("login")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "login" && styles.toggleTextActive,
              ]}
            >
              Log in
            </Text>
          </Pressable>

          <Pressable
            style={[styles.toggleBtn, mode === "signup" && styles.toggleActive]}
            onPress={() => setMode("signup")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "signup" && styles.toggleTextActive,
              ]}
            >
              Sign up
            </Text>
          </Pressable>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Submit button */}
          <Pressable
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading
                ? "Please wait…"
                : mode === "login"
                ? "Continue"
                : "Create account"}
            </Text>
          </Pressable>

          {mode === "login" && (
            <Pressable onPress={() => Alert.alert("Reset not implemented")}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },

  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  appName: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },

  toggleBox: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  toggleTextActive: {
    color: "#FFFFFF",
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 8,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  forgot: {
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
  },
});
