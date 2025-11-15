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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../api/client";

type Friend = {
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

export const FriendsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadFriends() {
    setLoading(true);
    try {
      const res = await apiGet("/friends");
      setFriends(res.friends ?? []);
    } catch (err: any) {
      console.log(err);
      Alert.alert("Error", err.message ?? "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFriends();
  }, []);

  async function handleAddFriend() {
    if (!friendEmail.trim()) {
      Alert.alert("Error", "Enter a friend email");
      return;
    }
    setAddingFriend(true);
    try {
      await apiPost("/friends/add", { email: friendEmail.trim() });
      setFriendEmail("");
      await loadFriends();
      Alert.alert("Success", "Friend added");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to add friend");
    } finally {
      setAddingFriend(false);
    }
  }

  function confirmRemoveFriend(friend: Friend) {
    const name = friend.displayName || friend.email || "this friend";
    Alert.alert("Remove friend", `Are you sure you want to remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => handleRemoveFriend(friend.id),
      },
    ]);
  }

  async function handleRemoveFriend(friendId: string) {
    setRemovingId(friendId);
    try {
      // adjust payload/path if your API expects something different
      await apiPost("/friends/remove", { friendId });
      await loadFriends();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to remove friend");
    } finally {
      setRemovingId(null);
    }
  }

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const name = (f.displayName || "").toLowerCase();
      const email = (f.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [friends, search]);

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>Compete with people you know</Text>
        </View>
        {friends.length > 0 && (
          <Text style={styles.count}>{friends.length}</Text>
        )}
      </View>

      {/* Add friend card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add friend by email</Text>
        <Text style={styles.cardSubtitle}>
          They’ll see your sleep stats once they accept.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="friend@example.com"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={friendEmail}
          onChangeText={setFriendEmail}
        />
        <Pressable
          style={[styles.primaryButton, addingFriend && { opacity: 0.7 }]}
          onPress={handleAddFriend}
          disabled={addingFriend}
        >
          <Text style={styles.primaryButtonText}>
            {addingFriend ? "Adding…" : "Add friend"}
          </Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Friends list */}
      <Text style={styles.sectionTitle}>Your friends</Text>
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadFriends} />
        }
        renderItem={({ item }) => {
          const name = item.displayName || item.email || "Unknown";
          const email = item.email;
          const initials =
            name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?";

          const isRemoving = removingId === item.id;

          return (
            <View style={styles.friendRow}>
              <View style={styles.friendLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View>
                  <Text style={styles.friendName}>{name}</Text>
                  {email ? (
                    <Text style={styles.friendEmail}>{email}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => confirmRemoveFriend(item)}
                disabled={isRemoving}
              >
                <Text style={styles.removeButtonText}>
                  {isRemoving ? "…" : "✕"}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              No friends yet. Add someone to start competing.
            </Text>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  count: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  primaryButton: {
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

  searchContainer: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },

  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  friendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  friendName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  friendEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
});
