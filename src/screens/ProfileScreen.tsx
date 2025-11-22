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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { apiGet, apiPost } from "../api/client";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";

// --- Types ---

type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
};

const SUPPORT_EMAIL = "support@sleepleague.app"; // change to your real address
const PRIVACY_URL = "https://your-site.com/privacy"; // your real URL

// --- Component ---

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // State
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --- Logic ---

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("No authenticated user");

      const email = userData.user.email ?? null;
      setAuthEmail(email);

      if (email) {
        try {
          await apiPost("/me/profile", { email });
        } catch (e) {
          // ignore initial creation errors
        }
      }

      const res = await apiGet("/me/profile");
      const prof = res.user as Profile | null;
      setProfile(prof);
      setDisplayName(prof?.displayName ?? "");
    } catch (err: any) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSave() {
    if (!authEmail) return;
    setSaving(true);
    try {
      await apiPost("/me/profile", {
        email: authEmail,
        displayName: displayName || undefined,
      });
      await loadProfile();
      Alert.alert("Profile Updated", "Your player card has been updated.");
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
    if (error) Alert.alert("Error", error.message);
  }

  function contactSupport() {
    const subject = encodeURIComponent("SlumberLeague Support");
    const body = encodeURIComponent(
      "Player ID: " + (profile?.id || "Unknown") + "\n\nI need help with..."
    );
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(mailto).catch(() => {
      Alert.alert("Email not available", `Please email us at ${SUPPORT_EMAIL}`);
    });
  }

  const nameForAvatar = displayName || authEmail || "Player";
  const initials =
    nameForAvatar
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 12 + insets.top },
        ]}
      >
        {/* Player Card Header */}
        <View style={styles.headerProfile}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>
            {displayName || "Unknown Player"}
          </Text>
          <Text style={styles.profileEmail}>{authEmail}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Active Duty</Text>
          </View>
        </View>

        {/* Edit Profile Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>PLAYER SETTINGS</Text>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your gamer tag"
                placeholderTextColor={theme.colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                saving && { opacity: 0.7 },
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Update Card</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Support & Legal */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <View style={styles.card}>
            <Pressable style={styles.menuItem} onPress={contactSupport}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuItemText}>Contact Command</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textTertiary}
              />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={openPrivacyPolicy}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuItemText}>Privacy Protocols</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>

          <Pressable onPress={() => setShowDeleteConfirm(true)}>
            <Text style={styles.deleteLink}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name="warning"
              size={32}
              color={theme.colors.error}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalText}>
              This action is irreversible. All your sleep data and stats will be
              wiped from the servers.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalDeleteBtn}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.modalDeleteText}>
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Header Profile
  headerProfile: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 10,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceHighlight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },

  // Sections
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Inputs
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },

  // Buttons
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // Menu Items
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginLeft: 12,
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },

  // Danger Zone
  dangerZone: {
    alignItems: "center",
    marginTop: 16,
    gap: 20,
  },
  logoutButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
  },
  logoutText: {
    color: theme.colors.error,
    fontSize: 15,
    fontWeight: "600",
  },
  deleteLink: {
    color: theme.colors.textTertiary,
    fontSize: 13,
    textDecorationLine: "underline",
  },

  // Modal
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceHighlight,
  },
  modalCancelText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: theme.colors.error + "20", // 20% opacity
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  modalDeleteText: {
    color: theme.colors.error,
    fontWeight: "600",
  },
});
