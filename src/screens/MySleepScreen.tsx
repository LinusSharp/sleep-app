import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from "react-native";
import { apiGet, apiPost } from "../api/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme"; // Ensure you have the theme file created in step 1

// --- Types ---

type SleepNight = {
  id: string;
  date: string; // "YYYY-MM-DD"
  totalSleepMinutes: number;
  remSleepMinutes: number;
  deepSleepMinutes: number;
};

// --- Logic Helpers ---

const GOAL_MINUTES = 8 * 60;

function calculateScore(totalMinutes: number) {
  // Simple gamified score: Percentage of 8 hours, capped at 100 (or slightly over for bonus)
  const score = Math.round((totalMinutes / GOAL_MINUTES) * 100);
  return score > 100 ? 100 : score;
}

function getRankTier(score: number) {
  if (score >= 100) return { label: "DIAMOND", color: "#22D3EE" }; // Cyan
  if (score >= 90) return { label: "PLATINUM", color: "#A78BFA" }; // Purple
  if (score >= 75) return { label: "GOLD", color: "#FBBF24" }; // Amber
  if (score >= 50) return { label: "SILVER", color: "#94A3B8" }; // Slate
  return { label: "BRONZE", color: "#475569" }; // Dark Slate
}

function minutesToHoursLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateLabel(dateInput: string) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return dateInput;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

// --- Main Component ---

export const MySleepScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // State
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [fakeModalVisible, setFakeModalVisible] = useState(false);
  const [fakeTotalHours, setFakeTotalHours] = useState("");
  const [fakeTotalMinutes, setFakeTotalMinutes] = useState("");
  const [fakeRemHours, setFakeRemHours] = useState("");
  const [fakeRemMinutes, setFakeRemMinutes] = useState("");
  const [fakeDeepHours, setFakeDeepHours] = useState("");
  const [fakeDeepMinutes, setFakeDeepMinutes] = useState("");
  const [fakeError, setFakeError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, []);

  // --- Fake Data Logic (Keep existing) ---
  async function sendFakeNight(total: number, rem: number, deep: number) {
    setSending(true);
    setError(null);
    try {
      const today = new Date();
      const isoDate = today.toISOString().slice(0, 10);
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

  function handleFakeSubmit() {
    setFakeError(null);
    const parse = (h: string, m: string) => {
      const hr = Number(h || "0");
      const mn = Number(m || "0");
      if (isNaN(hr) || isNaN(mn)) return null;
      return hr * 60 + mn;
    };

    const total = parse(fakeTotalHours, fakeTotalMinutes);
    const rem = parse(fakeRemHours, fakeRemMinutes);
    const deep = parse(fakeDeepHours, fakeDeepMinutes);

    if (total === null || rem === null || deep === null || total <= 0) {
      setFakeError("Invalid duration.");
      return;
    }
    if (rem + deep > total) {
      setFakeError("Components cannot exceed total.");
      return;
    }

    setFakeModalVisible(false);
    sendFakeNight(total, rem, deep);
  }

  // --- Render Components ---

  const renderHeroCard = () => {
    if (!latestNight) {
      return (
        <View style={styles.emptyHero}>
          <Ionicons name="moon" size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyHeroText}>No sleep data recorded.</Text>
          <Pressable
            style={styles.ctaButton}
            onPress={() => setFakeModalVisible(true)}
          >
            <Text style={styles.ctaButtonText}>Log Sleep</Text>
          </Pressable>
        </View>
      );
    }

    const score = calculateScore(latestNight.totalSleepMinutes);
    const rank = getRankTier(score);
    const progressPercent = Math.min(
      100,
      (latestNight.totalSleepMinutes / GOAL_MINUTES) * 100
    );

    return (
      <View style={styles.heroCard}>
        {/* Header: Date & Rank */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroDate}>
            {formatDateLabel(latestNight.date)}
          </Text>
          <View
            style={[
              styles.rankBadge,
              { borderColor: rank.color, backgroundColor: rank.color + "20" },
            ]}
          >
            <Text style={[styles.rankText, { color: rank.color }]}>
              {rank.label}
            </Text>
          </View>
        </View>

        {/* Main Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.scoreLabel}>Daily Score</Text>
          <Text style={[styles.scoreValue, { color: rank.color }]}>
            {score}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%`, backgroundColor: rank.color },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              {minutesToHoursLabel(latestNight.totalSleepMinutes)} slept
            </Text>
            <Text style={styles.progressText}>Goal: 8h</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons name="flash" size={16} color={theme.colors.accent} />
            <Text style={styles.statValue}>
              {minutesToHoursLabel(latestNight.remSleepMinutes)}
            </Text>
            <Text style={styles.statLabel}>REM</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons
              name="battery-charging"
              size={16}
              color={theme.colors.success}
            />
            <Text style={styles.statValue}>
              {minutesToHoursLabel(latestNight.deepSleepMinutes)}
            </Text>
            <Text style={styles.statLabel}>Deep</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Ionicons
              name="time"
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.statValue}>
              {minutesToHoursLabel(
                latestNight.totalSleepMinutes -
                  latestNight.remSleepMinutes -
                  latestNight.deepSleepMinutes
              )}
            </Text>
            <Text style={styles.statLabel}>Light</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHistoryItem = ({ item }: { item: SleepNight }) => {
    const score = calculateScore(item.totalSleepMinutes);
    const rank = getRankTier(score);

    return (
      <View style={styles.historyRow}>
        <View
          style={[styles.historyIndicator, { backgroundColor: rank.color }]}
        />
        <View style={styles.historyContent}>
          <View>
            <Text style={styles.historyDate}>{formatDateLabel(item.date)}</Text>
            <Text style={styles.historySubText}>
              {rank.label} • {score} pts
            </Text>
          </View>
          <Text style={styles.historyValue}>
            {minutesToHoursLabel(item.totalSleepMinutes)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      {/* Top Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your recovery</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setFakeModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Hero Card */}
        {renderHeroCard()}

        {/* Match History */}
        <Text style={styles.sectionTitle}>Recent Matches</Text>
        {nights.length > 0 ? (
          <View style={styles.listContainer}>
            {nights.map((night) => (
              <React.Fragment key={night.id}>
                {renderHistoryItem({ item: night })}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Start sleeping to build your history.
          </Text>
        )}
      </ScrollView>

      {/* --- LOG SLEEP MODAL (Dark Themed) --- */}
      <Modal
        visible={fakeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFakeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>Log Session</Text>
            <Text style={styles.modalSub}>
              Manually enter your sleep stats.
            </Text>

            {/* Input Group: Total */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Duration</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="08"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  value={fakeTotalHours}
                  onChangeText={setFakeTotalHours}
                />
                <Text style={styles.unit}>h</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  value={fakeTotalMinutes}
                  onChangeText={setFakeTotalMinutes}
                />
                <Text style={styles.unit}>m</Text>
              </View>
            </View>

            {/* Input Group: REM */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>REM Sleep</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="02"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  value={fakeRemHours}
                  onChangeText={setFakeRemHours}
                />
                <Text style={styles.unit}>h</Text>
                <TextInput
                  style={styles.input}
                  placeholder="00"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  value={fakeRemMinutes}
                  onChangeText={setFakeRemMinutes}
                />
                <Text style={styles.unit}>m</Text>
              </View>
            </View>

            {/* Input Group: Deep */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Deep Sleep</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="01"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  value={fakeDeepHours}
                  onChangeText={setFakeDeepHours}
                />
                <Text style={styles.unit}>h</Text>
                <TextInput
                  style={styles.input}
                  placeholder="45"
                  placeholderTextColor={theme.colors.textTertiary}
                  keyboardType="numeric"
                  value={fakeDeepMinutes}
                  onChangeText={setFakeDeepMinutes}
                />
                <Text style={styles.unit}>m</Text>
              </View>
            </View>

            {fakeError && <Text style={styles.modalError}>{fakeError}</Text>}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setFakeModalVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleFakeSubmit} style={styles.saveBtn}>
                <Text style={styles.saveText}>
                  {sending ? "Saving..." : "Save Log"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },

  // Header
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceHighlight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Hero Card
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heroDate: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  rankText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 14,
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: "800",
    lineHeight: 72,
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 24,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 16,
    paddingVertical: 16,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    height: "100%",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  // Empty States
  emptyHero: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  emptyHeroText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },

  // History List
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  listContainer: {
    gap: 12,
  },
  historyRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyIndicator: {
    width: 6,
    height: "100%",
  },
  historyContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  historySubText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  historyValue: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  emptyText: {
    color: theme.colors.textTertiary,
    textAlign: "center",
    marginTop: 20,
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: 10,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: "center",
  },
  unit: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveText: {
    color: "#FFF",
    fontWeight: "700",
  },
  modalError: {
    color: theme.colors.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
});
