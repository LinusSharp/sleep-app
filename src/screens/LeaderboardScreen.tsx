import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
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

function minutesToHours(mins: number) {
  return Math.round((mins / 60) * 10) / 10;
}

export const LeaderboardScreen: React.FC = () => {
  const [rows, setRows] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userData.user) {
          throw new Error("No auth user");
        }
        setMyUserId(userData.user.id);

        const res = await apiGet("/leaderboard?days=7");
        setRows(res.users ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>7-day leaderboard</Text>
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        style={{ marginTop: 12 }}
        data={rows}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item, index }) => {
          const isMe = item.userId === myUserId;
          const name = item.displayName || item.email || "Unknown";

          return (
            <View
              style={[
                styles.row,
                isMe && styles.meRow,
                index === 0 && styles.firstRow,
              ]}
            >
              <View style={styles.left}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View>
                  <Text style={[styles.name, isMe && styles.meName]}>
                    {name}
                  </Text>
                  {isMe && <Text style={styles.meTag}>You</Text>}
                </View>
              </View>
              <View style={styles.metrics}>
                <Text style={styles.metric}>
                  {minutesToHours(item.totalSleepMinutes)} h total
                </Text>
                <Text style={styles.metricSmall}>
                  REM {minutesToHours(item.remSleepMinutes)} h • Deep{" "}
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
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  title: { fontSize: 22, fontWeight: "700" },
  error: { color: "red", marginTop: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  meRow: {
    borderWidth: 1,
    borderColor: "#007aff",
  },
  firstRow: {
    backgroundColor: "#ffeeb5",
  },
  left: { flexDirection: "row", alignItems: "center" },
  rank: { fontSize: 18, fontWeight: "700", width: 28 },
  name: { fontSize: 14, fontWeight: "600" },
  meName: { color: "#007aff" },
  meTag: { fontSize: 11, color: "#007aff" },
  metrics: { alignItems: "flex-end" },
  metric: { fontSize: 13, fontWeight: "600" },
  metricSmall: { fontSize: 11, color: "#555" },
  emptyText: { fontSize: 13, color: "#666", marginTop: 12 },
});
