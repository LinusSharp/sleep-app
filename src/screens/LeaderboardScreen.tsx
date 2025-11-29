// --- START OF FILE LeaderboardScreen.tsx ---

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
  points: number; // Weekly Points
  value: number; // Weekly Raw Minutes
  nightsLogged: number;
};

type LeaderboardKey =
  | "survivalist"
  | "hibernator"
  | "tomRemmer"
  | "rollingInTheDeep";

type Leaderboards = {
  survivalist: LeaderboardUser[];
  hibernator: LeaderboardUser[];
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
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  // Controls
  const [scope, setScope] = useState<"friends" | "clan">("friends");
  const [selectedBoard, setSelectedBoard] =
    useState<LeaderboardKey>("survivalist");
  const [viewMode, setViewMode] = useState<"points" | "time">("points");
  const [infoVisible, setInfoVisible] = useState(false);

  // --- Initialization ---

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

      const res = await apiGet(`/leaderboard?scope=${scope}`);
      const lb = (res.leaderboards || {}) as Partial<Leaderboards>;

      setLeaderboards({
        survivalist: lb.survivalist ?? [],
        hibernator: lb.hibernator ?? [],
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
    return rawList.filter((user) => !blockedUsers.includes(user.userId));
  }, [leaderboards, selectedBoard, blockedUsers]);

  const myRowInfo = useMemo(() => {
    if (!myUserId || rows.length === 0) return null;
    const index = rows.findIndex((r) => r.userId === myUserId);
    if (index === -1) return null;
    const row = rows[index];

    return {
      rank: index + 1,
      points: row.points,
      value: minutesToHours(row.value),
      nights: row.nightsLogged,
    };
  }, [rows, myUserId]);

  // --- Actions & Safety ---

  const handleReportUser = async (user: LeaderboardUser) => {
    const subject = encodeURIComponent(
      `Report User: ${user.displayName || "Unknown"}`
    );
    const body = encodeURIComponent(`Report User ID: ${user.userId}`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(
        "Report",
        `Email ${SUPPORT_EMAIL} to report ID: ${user.userId}`
      );
    }
  };

  const handleBlockUser = async (userId: string) => {
    Alert.alert("Block User", "Hide this user from leaderboards?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          const newList = [...blockedUsers, userId];
          setBlockedUsers(newList);
          await AsyncStorage.setItem(
            BLOCKED_USERS_KEY,
            JSON.stringify(newList)
          );
        },
      },
    ]);
  };

  const handleRowPress = (user: LeaderboardUser) => {
    if (user.userId === myUserId) return;
    Alert.alert(user.displayName || "Player", "Actions", [
      { text: "Report", onPress: () => handleReportUser(user) },
      {
        text: "Block",
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
          <Text style={styles.subtitle}>Daily Scoring (Mon-Sun)</Text>
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

      {/* Scope Switcher & View Toggle */}
      <View style={styles.controlsRow}>
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

        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() =>
            setViewMode((prev) => (prev === "points" ? "time" : "points"))
          }
        >
          <Text style={styles.toggleText}>
            {viewMode === "points" ? "PTS" : "TIME"}
          </Text>
          <Ionicons
            name="swap-horizontal"
            size={14}
            color={theme.colors.primary}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
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
        <CategoryCard
          id="survivalist"
          icon="battery-charging-outline"
          label="Survivalist"
          selected={selectedBoard}
          onPress={setSelectedBoard}
        />
        <CategoryCard
          id="hibernator"
          icon="snow-outline"
          label="Hibernator"
          selected={selectedBoard}
          onPress={setSelectedBoard}
        />
        <CategoryCard
          id="tomRemmer"
          icon="flash-outline"
          label="Top REM-er"
          selected={selectedBoard}
          onPress={setSelectedBoard}
        />
        <CategoryCard
          id="rollingInTheDeep"
          icon="bed-outline"
          label="Rolling Deep"
          selected={selectedBoard}
          onPress={setSelectedBoard}
        />
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
              {myRowInfo.nights}/7 days logged
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {viewMode === "points" ? (
            <>
              <Text style={styles.myRankValue}>{myRowInfo.points}</Text>
              <Text style={styles.myRankUnit}>Points</Text>
            </>
          ) : (
            <>
              <Text style={styles.myRankValue}>{myRowInfo.value}h</Text>
              <Text style={styles.myRankUnit}>Total Time</Text>
            </>
          )}
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
          const rank = index + 1;
          const style = getRankStyle(rank);

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
                    {item.displayName || "Unknown"} {isMe && "(You)"}
                  </Text>
                  <Text style={styles.rowSubText}>
                    {item.nightsLogged}/7 days
                  </Text>
                </View>
              </View>

              <View style={styles.rowRight}>
                {viewMode === "points" ? (
                  <Text style={styles.rowValue}>
                    {item.points} <Text style={styles.rowUnit}>pts</Text>
                  </Text>
                ) : (
                  <Text style={styles.rowValue}>
                    {minutesToHours(item.value)}{" "}
                    <Text style={styles.rowUnit}>h</Text>
                  </Text>
                )}
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
              <Text style={styles.emptyText}>No data available.</Text>
              <Text style={styles.emptySubText}>
                Points are awarded daily.{"\n"}1st: 3pts, 2nd: 2pts, 3rd: 1pt.
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
            <Text style={styles.modalTitle}>Daily Scoring System</Text>
            <Text style={styles.infoRowDesc}>
              This is a daily competition. Every night, players are ranked in
              each category.
            </Text>
            <View style={{ marginVertical: 12 }}>
              <Text style={styles.ruleText}>
                🥇 1st Place:{" "}
                <Text style={{ fontWeight: "700", color: "#FFF" }}>
                  3 Points
                </Text>
              </Text>
              <Text style={styles.ruleText}>
                🥈 2nd Place:{" "}
                <Text style={{ fontWeight: "700", color: "#FFF" }}>
                  2 Points
                </Text>
              </Text>
              <Text style={styles.ruleText}>
                🥉 3rd Place:{" "}
                <Text style={{ fontWeight: "700", color: "#FFF" }}>
                  1 Point
                </Text>
              </Text>
            </View>
            <Text style={styles.infoRowDesc}>
              Points are summed up over the week (Mon-Sun) to determine the
              weekly champion.
            </Text>

            <View style={styles.divider} />

            <Text style={styles.modalSectionTitle}>New Category</Text>
            <View style={styles.infoRow}>
              <Ionicons
                name="snow-outline"
                size={20}
                color={theme.colors.primary}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.infoRowTitle}>The Hibernator</Text>
                <Text style={styles.infoRowDesc}>
                  For the heavy sleepers. Most Total Sleep duration wins.
                </Text>
              </View>
            </View>

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

const CategoryCard = ({ id, icon, label, selected, onPress }: any) => (
  <TouchableOpacity
    style={[styles.catCard, selected === id && styles.catCardActive]}
    onPress={() => onPress(id)}
  >
    <Ionicons
      name={icon}
      size={18}
      color={selected === id ? "#FFF" : theme.colors.textSecondary}
    />
    <Text style={[styles.catText, selected === id && styles.catTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.background,
  },
  headerContainer: { marginBottom: 12 },
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
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  infoButton: { padding: 4 },

  controlsRow: { flexDirection: "row", gap: 12 },
  scopeContainer: {
    flex: 1,
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
  scopeBtnActive: { backgroundColor: theme.colors.surfaceHighlight },
  scopeText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  scopeTextActive: { color: theme.colors.textPrimary },

  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },

  catScroll: { marginBottom: 16, marginHorizontal: -24 },
  catContainer: { paddingHorizontal: 24, gap: 10 },
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
  catTextActive: { color: "#FFFFFF" },

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
  myRankLeft: { flexDirection: "row", alignItems: "center" },
  myRankBadge: { alignItems: "center" },
  myRankLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginBottom: 2,
  },
  myRankBig: { fontSize: 24, fontWeight: "800" },
  myRankName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  myRankSub: { fontSize: 12, color: theme.colors.textSecondary },
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
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: { fontSize: 14, fontWeight: "800" },
  rowName: { fontSize: 15, fontWeight: "600", color: theme.colors.textPrimary },
  rowSubText: { fontSize: 11, color: theme.colors.textTertiary },
  crownBadge: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  crownText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.accent,
    marginLeft: 4,
  },
  rowRight: { alignItems: "flex-end" },
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

  emptyContainer: { alignItems: "center", marginTop: 40, padding: 20 },
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
    lineHeight: 20,
  },
  joinClanBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.surfaceHighlight,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  joinClanText: { color: theme.colors.primary, fontWeight: "600" },

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
  infoRow: { flexDirection: "row", marginBottom: 16 },
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
    fontSize: 14,
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
  modalCloseText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
