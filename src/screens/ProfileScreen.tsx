import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { apiGet, apiPost } from "../api/client";

type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export const ProfileScreen: React.FC = () => {
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    setLoading(true);
    try {
      // 1) get Supabase auth user
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("No authenticated user");
      }
      const email = userData.user.email ?? null;
      setAuthEmail(email);

      // 2) ensure backend user row exists (with email)
      if (email) {
        try {
          await apiPost("/me/profile", { email });
        } catch (e) {
          // ignore 400s here; we'll fetch whatever exists next
        }
      }

      // 3) fetch profile from backend
      const res = await apiGet("/me/profile");
      const prof = res.user as Profile | null;
      setProfile(prof);
      setDisplayName(prof?.displayName ?? "");
    } catch (err: any) {
      console.log(err);
      Alert.alert("Error", err.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSave() {
    if (!authEmail) {
      Alert.alert("Error", "Missing auth email");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/me/profile", {
        email: authEmail,
        displayName: displayName || undefined,
      });
      await loadProfile();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{authEmail ?? "Unknown"}</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="What should friends see?"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <View style={styles.buttonRow}>
          <Button
            title={saving ? "Saving..." : "Save profile"}
            onPress={handleSave}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Text style={styles.muted}>More options coming later.</Text>
      </View>

      <View style={styles.footer}>
        <Button title="Logout" color="red" onPress={handleLogout} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  center: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  label: { fontSize: 12, color: "#777", marginTop: 6 },
  value: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  buttonRow: { marginTop: 10 },
  muted: { fontSize: 13, color: "#777" },
  footer: { marginTop: 16 },
});
