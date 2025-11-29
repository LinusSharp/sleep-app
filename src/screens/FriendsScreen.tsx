// --- START OF FILE FriendsScreen.tsx ---

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Keyboard,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../api/client";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";

type Friend = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export const FriendsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [search, setSearch] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await apiGet("/friends");
      setFriends(res.friends ?? []);
    } catch (err: any) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddFriend() {
    if (!friendEmail.trim())
      return Alert.alert("Missing Info", "Enter an email.");
    setAddingFriend(true);
    try {
      await apiPost("/friends/add", { email: friendEmail.trim() });
      setFriendEmail("");
      await loadData();
      Alert.alert("Success", "Friend added.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setAddingFriend(false);
    }
  }

  function confirmRemoveFriend(friend: Friend) {
    Alert.alert(
      "Remove Friend",
      `Remove ${friend.displayName || friend.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => handleRemoveFriend(friend.id),
        },
      ]
    );
  }

  async function handleRemoveFriend(friendId: string) {
    setRemovingId(friendId);
    try {
      await apiPost("/friends/remove", { friendId });
      await loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setRemovingId(null);
    }
  }

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        (f.displayName || "").toLowerCase().includes(q) ||
        (f.email || "").toLowerCase().includes(q)
    );
  }, [friends, search]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Friends</Text>
            <Text style={styles.subtitle}>Your network</Text>
          </View>
        </View>

        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadData}
              tintColor={theme.colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.recruitCard}>
                <View style={styles.recruitHeader}>
                  <Ionicons
                    name="person-add"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.cardTitle}>Add Friend</Text>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="friend@email.com"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={friendEmail}
                    onChangeText={setFriendEmail}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleAddFriend}
                    disabled={addingFriend}
                  >
                    {addingFriend ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    )}
                  </Pressable>
                </View>
              </View>
              <View style={styles.searchContainer}>
                <Ionicons
                  name="search"
                  size={16}
                  color={theme.colors.textTertiary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search friends..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.displayName?.[0] || "?").toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>
                  {item.displayName || "Unknown"}
                </Text>
                <Text style={styles.rowSub}>{item.email}</Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmRemoveFriend(item)}
                disabled={removingId === item.id}
              >
                {removingId === item.id ? (
                  <ActivityIndicator size="small" color={theme.colors.error} />
                ) : (
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.textTertiary}
                  />
                )}
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.emptyText}>No friends yet.</Text>
            ) : null
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.textPrimary },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  recruitCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  recruitHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginLeft: 8,
  },
  inputRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginRight: 12,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: theme.colors.primary },
  rowContent: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "700", color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 20,
  },
});
