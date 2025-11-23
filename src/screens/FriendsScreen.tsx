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
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../api/client";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";

// --- Types ---

type Friend = {
  id: string;
  email: string | null;
  displayName: string | null;
};

type GroupMember = {
  id: string;
  displayName: string | null;
  email: string | null;
};

type Group = {
  id: string;
  name: string;
  code: string;
  members: GroupMember[];
};

// --- Component ---

export const FriendsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // Tabs: 'friends' | 'clan'
  const [activeTab, setActiveTab] = useState<"friends" | "clan">("friends");

  // Friends State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [search, setSearch] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);

  // Clan State
  const [myGroup, setMyGroup] = useState<Group | null>(null);

  // Split inputs for better UX
  const [joinCode, setJoinCode] = useState("");
  const [createName, setCreateName] = useState("");

  const [joiningClan, setJoiningClan] = useState(false);
  const [creatingClan, setCreatingClan] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // General
  const [loading, setLoading] = useState(false);

  // --- Logic ---

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === "friends") {
        const res = await apiGet("/friends");
        setFriends(res.friends ?? []);
      } else {
        const res = await apiGet("/groups/me");
        setMyGroup(res.group);
      }
    } catch (err: any) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // --- Friend Actions ---

  async function handleAddFriend() {
    if (!friendEmail.trim()) {
      return Alert.alert("Missing Info", "Enter an email.");
    }
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
    const name = friend.displayName || friend.email || "this player";
    Alert.alert("Remove Friend", `Are you sure you want to remove ${name}?`, [
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
      await apiPost("/friends/remove", { friendId });
      await loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setRemovingId(null);
    }
  }

  // --- Clan Actions ---

  async function handleCreateClan() {
    if (!createName.trim()) return Alert.alert("Error", "Enter a clan name");
    setCreatingClan(true);
    try {
      await apiPost("/groups/create", { name: createName.trim() });
      setCreateName("");
      await loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreatingClan(false);
    }
  }

  async function handleJoinClan() {
    if (!joinCode.trim()) return Alert.alert("Error", "Enter a clan code");
    setJoiningClan(true);
    try {
      await apiPost("/groups/join", { code: joinCode.trim().toUpperCase() });
      setJoinCode("");
      await loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setJoiningClan(false);
    }
  }

  async function handleLeaveClan() {
    Alert.alert("Leave Clan", "Are you sure you want to leave?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPost("/groups/leave", {});
            setMyGroup(null);
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
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

  // --- Renders ---

  const renderHeaderTabs = () => (
    <View style={styles.tabContainer}>
      <Pressable
        style={[styles.tab, activeTab === "friends" && styles.tabActive]}
        onPress={() => setActiveTab("friends")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "friends" && styles.tabTextActive,
          ]}
        >
          Friends
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tab, activeTab === "clan" && styles.tabActive]}
        onPress={() => setActiveTab("clan")}
      >
        <Text
          style={[styles.tabText, activeTab === "clan" && styles.tabTextActive]}
        >
          Clan
        </Text>
      </Pressable>
    </View>
  );

  const renderFriendsView = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        // FIX: Allow buttons to work while keyboard is open
        keyboardShouldPersistTaps="handled"
        // FIX: Close keyboard when scrolling
        onScrollBeginDrag={Keyboard.dismiss}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={theme.colors.primary}
          />
        }
        // FIX: Move Static content into Header so everything scrolls
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
              <Text style={styles.cardSubtitle}>
                Enter their email to add them to your list.
              </Text>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="friend@example.com"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={friendEmail}
                  onChangeText={setFriendEmail}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.addButton,
                    addingFriend && { opacity: 0.7 },
                    pressed && { opacity: 0.9 },
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
                style={styles.searchIcon}
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
        renderItem={({ item }) => {
          const isRemoving = removingId === item.id;
          return (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(
                    item.displayName?.[0] ||
                    item.email?.[0] ||
                    "?"
                  ).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.displayName || "Unknown"}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmRemoveFriend(item)}
                disabled={isRemoving}
              >
                {isRemoving ? (
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
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={48}
                color={theme.colors.textTertiary}
              />
              <Text style={styles.emptyText}>No friends added yet.</Text>
              {!search && (
                <Text style={styles.emptySubText}>
                  Add someone above to get started.
                </Text>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );

  const renderClanView = () => {
    if (!myGroup) {
      // Empty State (ScrollView is fine here)
      return (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadData}
              tintColor={theme.colors.primary}
            />
          }
        >
          <View style={styles.clanEmptyState}>
            <View style={styles.clanIconBig}>
              <Ionicons
                name="shield-outline"
                size={48}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.clanEmptyTitle}>Find Your Clan</Text>
            <Text style={styles.clanEmptySub}>
              Join a team to compete on the group leaderboard.
            </Text>
          </View>

          {/* Join Section */}
          <View style={styles.recruitCard}>
            <View style={styles.recruitHeader}>
              <Ionicons
                name="enter-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.cardTitle}>Join a Clan</Text>
            </View>
            <Text style={styles.cardSubtitle}>Have a code? Enter it here.</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter 8-digit code"
                placeholderTextColor={theme.colors.textTertiary}
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={setJoinCode}
              />
              <Pressable
                style={[styles.addButton, joiningClan && { opacity: 0.7 }]}
                onPress={handleJoinClan}
                disabled={joiningClan}
              >
                {joiningClan ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Create Section */}
          <View style={styles.recruitCard}>
            <View style={styles.recruitHeader}>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={theme.colors.accent}
              />
              <Text style={styles.cardTitle}>Create New Clan</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Start your own group and invite friends.
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Clan Name"
                placeholderTextColor={theme.colors.textTertiary}
                value={createName}
                onChangeText={setCreateName}
              />
              <Pressable
                style={[
                  styles.addButton,
                  { backgroundColor: theme.colors.accent },
                  creatingClan && { opacity: 0.7 },
                ]}
                onPress={handleCreateClan}
                disabled={creatingClan}
              >
                {creatingClan ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      );
    }

    // Joined State
    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={myGroup.members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadData}
              tintColor={theme.colors.primary}
            />
          }
          // FIX: Move header into list so it scrolls nicely
          ListHeaderComponent={
            <>
              <View style={styles.clanHeaderCard}>
                <View style={styles.clanBanner}>
                  <View style={styles.clanBadge}>
                    <Ionicons
                      name="shield"
                      size={28}
                      color={theme.colors.background}
                    />
                  </View>
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Text style={styles.clanName}>{myGroup.name}</Text>
                    <Text style={styles.clanCount}>
                      {myGroup.members.length} Members
                    </Text>
                  </View>
                </View>

                {/* Code Display */}
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>INVITE CODE:</Text>
                  <Text style={styles.codeValue}>{myGroup.code}</Text>
                </View>

                <Pressable style={styles.leaveBtn} onPress={handleLeaveClan}>
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={theme.colors.error}
                  />
                </Pressable>
              </View>
              <Text style={styles.sectionTitle}>MEMBERS</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View
                style={[styles.avatar, { borderColor: theme.colors.accent }]}
              >
                <Text
                  style={[styles.avatarText, { color: theme.colors.accent }]}
                >
                  {(
                    item.displayName?.[0] ||
                    item.email?.[0] ||
                    "?"
                  ).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>
                  {item.displayName || "Unknown"}
                </Text>
                <Text style={styles.rowSub}>{item.email}</Text>
              </View>
            </View>
          )}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Social</Text>
            <Text style={styles.subtitle}>Manage your network</Text>
          </View>
        </View>

        {renderHeaderTabs()}

        <View style={{ flex: 1, marginTop: 16 }}>
          {activeTab === "friends" ? renderFriendsView() : renderClanView()}
        </View>
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

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginLeft: 6,
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: theme.colors.surfaceHighlight,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: theme.colors.textPrimary,
  },

  // Recruit/Input Card
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
  cardSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
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
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  // Friend List
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
  searchIcon: { marginRight: 8 },
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
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  rowContent: { flex: 1 },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 20,
  },

  // CLAN VIEWS
  clanEmptyState: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 32,
  },
  clanIconBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clanEmptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  clanEmptySub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // Clan Active View
  clanHeaderCard: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginBottom: 24,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  clanBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  clanBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  clanName: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },
  clanCount: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  codeContainer: {
    backgroundColor: theme.colors.surfaceHighlight,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  codeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.accent,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  leaveBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    padding: 10,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginBottom: 12,
    marginLeft: 8,
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
    padding: 20,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginTop: 4,
    textAlign: "center",
  },
});
