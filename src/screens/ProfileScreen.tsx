import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { apiGet, apiPost } from "../api/client";

type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
};

const colors = {
  background: "#F4F5FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF1FF",
  primary: "#1E2554",
  primaryLight: "#3C4AA8",
  accent: "#FFB347",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  border: "#D0D4E6",
  error: "#E53935",
};

const SUPPORT_EMAIL = "support@sleepleague.app"; // change to your real address
const PRIVACY_URL = "https://your-site.com/privacy"; // your real URL

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("No authenticated user");
      }
      const email = userData.user.email ?? null;
      setAuthEmail(email);

      if (email) {
        try {
          await apiPost("/me/profile", { email });
        } catch (e) {
          // ignore 400s here; we'll fetch whatever exists next
        }
      }

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

  function openPrivacyPolicy() {
    Linking.openURL(PRIVACY_URL).catch(() => {
      Alert.alert("Error", "Could not open privacy policy.");
    });
  }

  async function handleDeleteAccount() {
    if (!authEmail) return;

    setDeleting(true);
    try {
      await apiPost("/me/delete-account", {});

      await supabase.auth.signOut();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    }
  }

  function contactSupport() {
    const subject = encodeURIComponent("Sleep League support");
    const body = encodeURIComponent(
      "Hi Sleep League team,\n\nI need help with...\n\n"
    );

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    Linking.openURL(mailto).catch(() => {
      Alert.alert("Email not available", `Please email us at ${SUPPORT_EMAIL}`);
    });
  }

  const nameForAvatar = displayName || authEmail || "You";
  const initials =
    nameForAvatar
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: 12 + insets.top },
          styles.center,
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.title}>{displayName || "Your profile"}</Text>
            <Text style={styles.subtitle}>
              {authEmail ?? "No email on file"}
            </Text>
          </View>
        </View>
      </View>

      {/* Account card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{authEmail ?? "Unknown"}</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="What should friends see?"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Pressable
          style={[styles.primaryButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? "Saving…" : "Save profile"}
          </Text>
        </Pressable>
      </View>

      {/* Settings card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Text style={styles.muted}>More options coming later.</Text>
      </View>

      {/* Support card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Support</Text>
        <Text style={styles.muted}>Need help with Sleep League?</Text>

        <Pressable style={styles.supportButton} onPress={contactSupport}>
          <Text style={styles.supportButtonText}>Contact support</Text>
        </Pressable>
        <Pressable onPress={openPrivacyPolicy} style={{ marginTop: 8 }}>
          <Text style={styles.privacyLink}>View privacy policy</Text>
        </Pressable>
      </View>

      {/* Logout */}
      <View style={{ marginBottom: 16 }}>
        <Pressable
          style={styles.deleteButton}
          onPress={() => setShowDeleteConfirm(true)}
        >
          <Text style={styles.deleteButtonText}>Delete account</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
      {showDeleteConfirm && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalSubtitle}>
              This will permanently erase your sleep data, friends, and profile.
            </Text>

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {deleting ? "Deleting…" : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    fontSize: 14,
    color: colors.textPrimary,
  },

  primaryButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  muted: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  footer: {
    marginTop: "auto",
    marginBottom: 24,
  },
  logoutButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
  },

  deleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
  },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginLeft: 8,
  },
  modalButtonSecondary: {
    backgroundColor: "transparent",
  },
  modalButtonSecondaryText: {
    color: colors.textSecondary,
  },
  modalButtonPrimary: {
    backgroundColor: colors.error,
  },
  modalButtonPrimaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  supportButton: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  supportButtonText: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: "600",
  },
  privacyLink: {
    fontSize: 13,
    color: colors.primaryLight,
    textAlign: "center",
  },
});
