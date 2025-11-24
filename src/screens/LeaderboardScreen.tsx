import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "../api/client";
import { supabase } from "../lib/supabase";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

// --- Types ---

type LeaderboardUser = {
  userId: string;
  displayName: string | null;
  email: string | null;
  totalSleepMinutes: number;
  remSleepMinutes: number;
  deepSleepMinutes: number;
  nightsLogged: number;
};

type LeaderboardKey = "survivalist" | "tomRemmer" | "rollingInTheDeep";

type Leaderboards = {
  survivalist: LeaderboardUser[];
  tomRemmer: LeaderboardUser[];
  rollingInTheDeep: LeaderboardUser[];
};

// --- Constants ---

const SUPPORT_EMAIL = "linus.sharp@gmail.com";
const BLOCKED_USERS_KEY = "slumber_blocked_users_v1";

// --- Helpers ---

function minutesToHours(mins: number) {
  return Math.round((mins / 60) * 10) / 10;
}

function getRankStyle(rank: number) {
  if (rank === 1)
    return {
      color: "#FBBF24",
      bg: "rgba(251, 191, 36, 0.10)",
      border: "#FBBF24",
      icon: "trophy",
    }; // Gold
  if (rank === 2)
    return {
      color: "#E2E8F0",
      bg: "rgba(226, 232, 240, 0.10)",
      border: "#94A3B8",
      icon: "medal",
    }; // Silver
  if (rank === 3)
    return {
      color: "#B45309",
      bg: "rgba(180, 83, 9, 0.10)",
      border: "#B45309",
      icon: "medal-outline",
    }; // Bronze
  return {
    color: theme.colors.textSecondary,
    bg: theme.colors.surface,
    border: theme.colors.border,
    icon: null,
  }; // Standard
}

// --- Component ---

export const LeaderboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Data
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);

  // APPLE COMPLIANCE: Persistent Block List state
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // Controls
  const [scope, setScope] = useState<"friends" | "clan">("friends");
  const [selectedBoard, setSelectedBoard] =
    useState<LeaderboardKey>("survivalist");
  const [infoVisible, setInfoVisible] = useState(false);

  // --- Initialization ---

  // 1. Load Local Block List on Mount
  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        const stored = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
        if (stored) {
          setBlockedUsers(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Failed to load blocked users", error);
      }
    };
    loadBlockedUsers();
  }, []);

  // 2. Load API Data when scope changes
  useEffect(() => {
    loadLeaderboard();
  }, [scope]);

  async function loadLeaderboard(options?: { refresh?: boolean }) {
    const refresh = options?.refresh ?? false;
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("No auth user");
      setMyUserId(userData.user.id);

      // Pass the scope (friends vs clan) to the backend
      const res = await apiGet(`/leaderboard?scope=${scope}`);

      const lb = (res.leaderboards || {}) as Partial<Leaderboards>;

      setLeaderboards({
        survivalist: lb.survivalist ?? [],
        tomRemmer: lb.tomRemmer ?? [],
        rollingInTheDeep: lb.rollingInTheDeep ?? [],
      });
    } catch (e: any) {
      console.log(e);
    } finally {
      if (refresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  // --- Filtering Logic ---

  const rows = useMemo<LeaderboardUser[]>(() => {
    if (!leaderboards) return [];
    const rawList = leaderboards[selectedBoard] ?? [];

    // APPLE REQUIREMENT: Strict filtering of blocked users
    return rawList.filter((user) => !blockedUsers.includes(user.userId));
  }, [leaderboards, selectedBoard, blockedUsers]);

  const myRowInfo = useMemo(() => {
    if (!myUserId || rows.length === 0) return null;
    const index = rows.findIndex((r) => r.userId === myUserId);
    if (index === -1) return null;
    const row = rows[index];

    // Determine value based on board
    let val = 0;
    if (selectedBoard === "survivalist") val = row.totalSleepMinutes;
    else if (selectedBoard === "tomRemmer") val = row.remSleepMinutes;
    else val = row.deepSleepMinutes;

    return {
      rank: index + 1,
      value: minutesToHours(val),
      nights: row.nightsLogged,
    };
  }, [rows, myUserId, selectedBoard]);

  // --- Actions & Safety ---

  const handleReportUser = async (user: LeaderboardUser) => {
    const subject = encodeURIComponent(
      `Report User: ${user.displayName || "Unknown"}`
    );
    const body = encodeURIComponent(
      `I would like to report user with ID: ${user.userId}\n\nReason for report:\n`
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        throw new Error("No email client");
      }
    } catch (e) {
      // APPLE COMPLIANCE: Fallback if no mail app installed
      Alert.alert(
        "Report User",
        `Please email ${SUPPORT_EMAIL} to report this user.\nUser ID: ${user.userId}`,
        [{ text: "OK" }]
      );
    }
  };

  const handleBlockUser = async (userId: string) => {
    Alert.alert(
      "Block User",
      "You will no longer see this user on the leaderboards. This will be saved to your device settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Update State immediately
              const newList = [...blockedUsers, userId];
              setBlockedUsers(newList);

              // 2. Persist to Storage (Critical for App Review)
              await AsyncStorage.setItem(
                BLOCKED_USERS_KEY,
                JSON.stringify(newList)
              );

              Alert.alert(
                "Blocked",
                "User has been hidden from your leaderboards."
              );
            } catch (error) {
              Alert.alert("Error", "Could not save block preference.");
            }
          },
        },
      ]
    );
  };

  const handleRowPress = (user: LeaderboardUser) => {
    // Don't report yourself
    if (user.userId === myUserId) return;

    Alert.alert(user.displayName || "Unknown Player", "Select an action", [
      {
        text: "Report Content",
        onPress: () => handleReportUser(user),
      },
      {
        text: "Block User",
        style: "destructive",
        onPress: () => handleBlockUser(user.userId),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // --- Renderers ---

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Weekly Competition (Mon-Sun)</Text>
        </View>
        <TouchableOpacity
          onPress={() => setInfoVisible(true)}
          style={styles.infoButton}
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Scope Switcher */}
      <View style={styles.scopeContainer}>
        <Pressable
          style={[
            styles.scopeBtn,
            scope === "friends" && styles.scopeBtnActive,
          ]}
          onPress={() => setScope("friends")}
        >
          <Text
            style={[
              styles.scopeText,
              scope === "friends" && styles.scopeTextActive,
            ]}
          >
            Friends
          </Text>
        </Pressable>
        <Pressable
          style={[styles.scopeBtn, scope === "clan" && styles.scopeBtnActive]}
          onPress={() => setScope("clan")}
        >
          <Text
            style={[
              styles.scopeText,
              scope === "clan" && styles.scopeTextActive,
            ]}
          >
            Clan
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.catScroll}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catContainer}
      >
        <TouchableOpacity
          style={[
            styles.catCard,
            selectedBoard === "survivalist" && styles.catCardActive,
          ]}
          onPress={() => setSelectedBoard("survivalist")}
        >
          <Ionicons
            name="battery-charging-outline"
            size={18}
            color={
              selectedBoard === "survivalist"
                ? "#FFF"
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.catText,
              selectedBoard === "survivalist" && styles.catTextActive,
            ]}
          >
            Survivalist
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.catCard,
            selectedBoard === "tomRemmer" && styles.catCardActive,
          ]}
          onPress={() => setSelectedBoard("tomRemmer")}
        >
          <Ionicons
            name="flash-outline"
            size={18}
            color={
              selectedBoard === "tomRemmer"
                ? "#FFF"
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.catText,
              selectedBoard === "tomRemmer" && styles.catTextActive,
            ]}
          >
            Tom REM-er
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.catCard,
            selectedBoard === "rollingInTheDeep" && styles.catCardActive,
          ]}
          onPress={() => setSelectedBoard("rollingInTheDeep")}
        >
          <Ionicons
            name="bed-outline"
            size={18}
            color={
              selectedBoard === "rollingInTheDeep"
                ? "#FFF"
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.catText,
              selectedBoard === "rollingInTheDeep" && styles.catTextActive,
            ]}
          >
            Rolling Deep
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderMyRank = () => {
    if (!myRowInfo) return null;
    const style = getRankStyle(myRowInfo.rank);

    return (
      <View
        style={[
          styles.myRankCard,
          { borderColor: style.border, borderWidth: 1 },
        ]}
      >
        <View style={styles.myRankLeft}>
          <View style={styles.myRankBadge}>
            <Text style={styles.myRankLabel}>YOUR RANK</Text>
            <Text
              style={[
                styles.myRankBig,
                {
                  color:
                    myRowInfo.rank <= 3
                      ? style.color
                      : theme.colors.textPrimary,
                },
              ]}
            >
              #{myRowInfo.rank}
            </Text>
          </View>
          <View style={{ marginLeft: 16 }}>
            <Text style={styles.myRankName}>You</Text>
            <Text style={styles.myRankSub}>
              {myRowInfo.nights} nights logged
            </Text>
          </View>
        </View>
        <View>
          <Text style={styles.myRankValue}>{myRowInfo.value}h</Text>
          <Text style={styles.myRankUnit}>Total</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      {renderHeader()}
      {renderCategories()}

      {loading && !refreshing && (
        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: 20 }}
        />
      )}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadLeaderboard({ refresh: true })}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={renderMyRank}
        renderItem={({ item, index }) => {
          const isMe = item.userId === myUserId;
          const name = item.displayName || item.email || "Unknown";
          const rank = index + 1;
          const style = getRankStyle(rank);

          let value = 0;
          if (selectedBoard === "survivalist") value = item.totalSleepMinutes;
          else if (selectedBoard === "tomRemmer") value = item.remSleepMinutes;
          else value = item.deepSleepMinutes;

          return (
            <TouchableOpacity
              onPress={() => handleRowPress(item)}
              activeOpacity={isMe ? 1 : 0.7}
              style={[
                styles.row,
                {
                  borderColor: isMe ? theme.colors.primary : style.border,
                  backgroundColor: style.bg,
                },
              ]}
            >
              <View style={styles.rowLeft}>
                <View
                  style={[
                    styles.rankBadge,
                    {
                      backgroundColor:
                        rank <= 3 ? style.color : theme.colors.surfaceHighlight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rankText,
                      {
                        color: rank <= 3 ? "#000" : theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {rank}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.rowName,
                      isMe && { color: theme.colors.primary },
                    ]}
                  >
                    {name} {isMe && "(You)"}
                  </Text>
                  {rank === 1 && (
                    <View style={styles.crownBadge}>
                      <Ionicons
                        name="trophy"
                        size={10}
                        color={theme.colors.accent}
                      />
                      <Text style={styles.crownText}>LEADER</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>
                  {minutesToHours(value)} <Text style={styles.rowUnit}>h</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={scope === "clan" ? "shield-outline" : "people-outline"}
                size={48}
                color={theme.colors.textTertiary}
              />
              <Text style={styles.emptyText}>No data found.</Text>
              <Text style={styles.emptySubText}>
                {scope === "clan"
                  ? "You might not be in a clan, or no one has slept yet."
                  : "Add friends or log sleep to see rankings."}
              </Text>
              {scope === "clan" && (
                <TouchableOpacity
                  onPress={() => navigation.navigate("Friends")}
                  style={styles.joinClanBtn}
                >
                  <Text style={styles.joinClanText}>Find a Clan</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />

      {/* --- INFO MODAL --- */}
      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How it Works</Text>
              <TouchableOpacity onPress={() => setInfoVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.modalSectionTitle}>Categories</Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="battery-charging-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.infoRowTitle}>Survivalist</Text>
                  <Text style={styles.infoRowDesc}>
                    Whoever functions on the LEAST amount of sleep. Total
                    duration sorted ascending.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="flash-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.infoRowTitle}>Tom REM-er</Text>
                  <Text style={styles.infoRowDesc}>
                    Who has the most vivid dreams? Total REM sleep sorted
                    descending.
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="bed-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.infoRowTitle}>Rolling in the Deep</Text>
                  <Text style={styles.infoRowDesc}>
                    Physical recovery king. Total Deep sleep sorted descending.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.modalSectionTitle}>Rules & Safety</Text>
              <Text style={styles.ruleText}>
                • Competition runs Monday to Sunday.
              </Text>
              <Text style={styles.ruleText}>
                • Offensive names will result in a ban.
              </Text>
              <Text style={styles.ruleText}>
                • You can tap any player to Report or Block them.
              </Text>
            </ScrollView>

            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.modalCloseText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.background,
  },

  // Header
  headerContainer: {
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
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
    marginTop: 2,
  },
  infoButton: {
    padding: 4,
  },

  // Scope Switcher
  scopeContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  scopeBtnActive: {
    backgroundColor: theme.colors.surfaceHighlight,
  },
  scopeText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  scopeTextActive: {
    color: theme.colors.textPrimary,
  },

  // Categories
  catScroll: {
    marginBottom: 16,
    marginHorizontal: -24, // break container padding
  },
  catContainer: {
    paddingHorizontal: 24,
    gap: 10,
  },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  catTextActive: {
    color: "#FFFFFF",
  },

  // My Rank
  myRankCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  myRankLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  myRankBadge: {
    alignItems: "center",
  },
  myRankLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginBottom: 2,
  },
  myRankBig: {
    fontSize: 24,
    fontWeight: "800",
  },
  myRankName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  myRankSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  myRankValue: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  myRankUnit: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    textAlign: "right",
  },

  // List Item
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "800",
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  crownBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  crownText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.accent,
    marginLeft: 4,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowValue: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  rowUnit: {
    fontSize: 12,
    fontWeight: "400",
    color: theme.colors.textTertiary,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    marginTop: 4,
    textAlign: "center",
  },
  joinClanBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.surfaceHighlight,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  joinClanText: {
    color: theme.colors.primary,
    fontWeight: "600",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  infoRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  infoRowDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  ruleText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  modalCloseBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  modalCloseText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
  error: {
    color: theme.colors.error,
    marginBottom: 10,
    textAlign: "center",
  },
});
