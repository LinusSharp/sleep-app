import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Button,
} from "react-native";
import { apiGet, apiPost } from "../api/client";

type SleepNight = {
  id: string;
  date: string;
  totalSleepMinutes: number;
  remSleepMinutes: number;
  deepSleepMinutes: number;
};

function minutesToHoursLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

export const MySleepScreen: React.FC = () => {
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestNight = useMemo(
    () => (nights.length > 0 ? nights[0] : null),
    [nights]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet("/sleep/me?days=7");
      setNights(data.nights ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // generate realistic nightly sleep values
  function generateFakeSleep() {
    // total sleep: 5h–9h (300–540 mins)
    const total = Math.round(300 + Math.random() * 240);

    // REM: usually 18–25% of total sleep
    const rem = Math.round(total * (0.18 + Math.random() * 0.07));

    // Deep: usually 12–23% of total sleep
    const deep = Math.round(total * (0.12 + Math.random() * 0.11));

    // Safety: never let REM + Deep exceed total
    if (rem + deep > total) {
      const scale = total / (rem + deep);
      return {
        total,
        rem: Math.round(rem * scale),
        deep: Math.round(deep * scale),
      };
    }

    return { total, rem, deep };
  }

  async function sendFakeNight() {
    setSending(true);
    setError(null);

    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 8);
      const isoDate = today.toISOString().slice(0, 10);

      const { total, rem, deep } = generateFakeSleep();

      await apiPost("/sleep/upload", {
        date: isoDate,
        totalSleepMinutes: total,
        remSleepMinutes: rem,
        deepSleepMinutes: deep,
      });

      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Sleep</Text>
        <Text style={styles.fakeLink} onPress={sendFakeNight}>
          {sending ? "Saving..." : "Add fake night"}
        </Text>
      </View>

      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Today summary card */}
      {latestNight ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Last night</Text>
          <Text style={styles.cardDate}>
            {new Date(latestNight.date).toISOString().slice(0, 10)}
          </Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Total</Text>
              <Text style={styles.metricValue}>
                {minutesToHoursLabel(latestNight.totalSleepMinutes)}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>REM</Text>
              <Text style={styles.metricValue}>
                {minutesToHoursLabel(latestNight.remSleepMinutes)}
              </Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>Deep</Text>
              <Text style={styles.metricValue}>
                {minutesToHoursLabel(latestNight.deepSleepMinutes)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={{ marginTop: 16 }}>No data yet.</Text>
      )}

      {/* History list */}
      <Text style={styles.sectionTitle}>Last 7 nights</Text>
      <FlatList
        data={nights}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => {
          const date = new Date(item.date).toISOString().slice(0, 10);
          return (
            <View style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyDate}>{date}</Text>
              </View>
              <View style={styles.historyMetric}>
                <Text style={styles.historyLabel}>Total</Text>
                <Text>{minutesToHoursLabel(item.totalSleepMinutes)}</Text>
              </View>
              <View style={styles.historyMetric}>
                <Text style={styles.historyLabel}>REM</Text>
                <Text>
                  {Math.round((item.remSleepMinutes / 60) * 10) / 10} h
                </Text>
              </View>
              <View style={styles.historyMetric}>
                <Text style={styles.historyLabel}>Deep</Text>
                <Text>
                  {Math.round((item.deepSleepMinutes / 60) * 10) / 10} h
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: "700" },
  fakeLink: { color: "#007aff", fontWeight: "500" },
  centerRow: { marginTop: 16, alignItems: "center" },
  error: { color: "red", marginTop: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: { fontSize: 14, color: "#666" },
  cardDate: { fontSize: 16, fontWeight: "500", marginBottom: 12 },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricCol: { flex: 1, alignItems: "center" },
  metricLabel: { fontSize: 13, color: "#777", marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: "600" },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: "600",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 8,
  },
  historyDate: { fontSize: 14, fontWeight: "500" },
  historyMetric: { alignItems: "flex-end", marginLeft: 12 },
  historyLabel: { fontSize: 11, color: "#777" },
});
