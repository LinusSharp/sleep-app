import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet } from "../api/client";
import { supabase } from "../lib/supabase";

type LeaderboardUser = {
  userId: string;
  displayName: string | null;
  email: string | null;
  totalSleepMinutes: number;
  remSleepMinutes: number;
  deepSleepMinutes: number;
};

type LeaderboardKey = "survivalist" | "tomRemmer" | "rollingInTheDeep";

type Leaderboards = {
  survivalist: LeaderboardUser[];
  tomRemmer: LeaderboardUser[];
  rollingInTheDeep: LeaderboardUser[];
};

const WORK_NIGHTS_PER_WEEK = 5;

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

function minutesToHours(mins: number) {
  return Math.round((mins / 60) * 10) / 10;
}

export const LeaderboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [selectedBoard, setSelectedBoard] =
    useState<LeaderboardKey>("survivalist");

  async function loadLeaderboard(options?: { refresh?: boolean }) {
    const refresh = options?.refresh ?? false;
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("No auth user");
      }
      setMyUserId(userData.user.id);

      const res = await apiGet("/leaderboard?days=7");
      const lb = (res.leaderboards || {}) as Partial<Leaderboards>;

      setLeaderboards({
        survivalist: lb.survivalist ?? [],
        tomRemmer: lb.tomRemmer ?? [],
        rollingInTheDeep: lb.rollingInTheDeep ?? [],
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (refresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  const rows = useMemo<LeaderboardUser[]>(() => {
    if (!leaderboards) return [];
    return leaderboards[selectedBoard] ?? [];
  }, [leaderboards, selectedBoard]);
  const myRowInfo = useMemo(() => {
    if (!myUserId || rows.length === 0) return null;
    const index = rows.findIndex((r) => r.userId === myUserId);
    if (index === -1) return null;
    const row = rows[index];
    return {
      rank: index + 1,
      totalHours: minutesToHours(row.totalSleepMinutes),
      avgPerNight: minutesToHours(row.totalSleepMinutes / WORK_NIGHTS_PER_WEEK),
    };
  }, [rows, myUserId]);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Last 7 days</Text>
        </View>
      </View>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedBoard === "survivalist" && styles.tabButtonActive,
          ]}
          onPress={() => setSelectedBoard("survivalist")}
        >
          <Text
            style={[
              styles.tabLabel,
              selectedBoard === "survivalist" && styles.tabLabelActive,
            ]}
          >
            Survivalist
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedBoard === "tomRemmer" && styles.tabButtonActive,
          ]}
          onPress={() => setSelectedBoard("tomRemmer")}
        >
          <Text
            style={[
              styles.tabLabel,
              selectedBoard === "tomRemmer" && styles.tabLabelActive,
            ]}
          >
            Tom Remmer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            selectedBoard === "rollingInTheDeep" && styles.tabButtonActive,
          ]}
          onPress={() => setSelectedBoard("rollingInTheDeep")}
        >
          <Text
            style={[
              styles.tabLabel,
              selectedBoard === "rollingInTheDeep" && styles.tabLabelActive,
            ]}
          >
            Rolling in the deep
          </Text>
        </TouchableOpacity>
      </View>
      {loading && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Your position card */}
      {myRowInfo && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your position</Text>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.rankBig}>#{myRowInfo.rank}</Text>
              <Text style={styles.rankSub}>out of {rows.length}</Text>
            </View>
            <View style={styles.cardMetricsRight}>
              <Text style={styles.cardMetric}>
                {myRowInfo.totalHours} h total
              </Text>
              <Text style={styles.cardMetricSub}>
                Avg {myRowInfo.avgPerNight} h / night
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* List */}
      <FlatList
        style={{ marginTop: 12 }}
        data={rows}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadLeaderboard({ refresh: true })}
          />
        }
        renderItem={({ item, index }) => {
          const isMe = item.userId === myUserId;
          const name = item.displayName || item.email || "Unknown";

          const rank = index + 1;
          let badgeColor: string | null = null;
          if (rank === 1) badgeColor = "#FACC15"; // gold
          if (rank === 2) badgeColor = "#E5E7EB"; // silver
          if (rank === 3) badgeColor = "#FDBA74"; // bronze

          return (
            <View style={[styles.row, isMe && styles.meRow]}>
              <View style={styles.left}>
                <View style={styles.rankBadgeWrapper}>
                  <View
                    style={[
                      styles.rankBadge,
                      badgeColor && { backgroundColor: badgeColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankText,
                        badgeColor && { color: "#111827" },
                      ]}
                    >
                      {rank}
                    </Text>
                  </View>
                </View>
                <View>
                  <Text style={[styles.name, isMe && styles.meName]}>
                    {name}
                  </Text>
                  <View style={styles.tagRow}>
                    {isMe && <Text style={styles.meTag}>You</Text>}
                    {badgeColor && (
                      <Text style={styles.positionTag}>
                        {rank === 1
                          ? selectedBoard === "survivalist"
                            ? "Top survivalist"
                            : selectedBoard === "tomRemmer"
                            ? "Top REM"
                            : "Top deep"
                          : rank === 2
                          ? "2nd place"
                          : "3rd place"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.metrics}>
                <Text style={styles.metric}>
                  {minutesToHours(item.totalSleepMinutes)} h total
                </Text>
                <Text style={styles.metricSmall}>
                  REM {minutesToHours(item.remSleepMinutes)} h · Deep{" "}
                  {minutesToHours(item.deepSleepMinutes)} h
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.emptyText}>
              No data yet. Sleep a few nights and add friends.
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
  error: {
    color: colors.error,
    marginTop: 8,
    fontSize: 13,
  },

  // Your position card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rankBig: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  rankSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardMetricsRight: {
    alignItems: "flex-end",
  },
  cardMetric: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  cardMetricSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // List rows
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meRow: {
    borderColor: colors.primaryLight,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rankBadgeWrapper: {
    marginRight: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  meName: {
    color: colors.primaryLight,
  },
  tagRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  meTag: {
    fontSize: 11,
    color: colors.primaryLight,
    marginRight: 8,
  },
  positionTag: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  metrics: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  metric: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  metricSmall: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: "center",
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: 8,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: colors.surfaceMuted,
  },
  tabLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
});
