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
} from "react-native";
import { apiGet, apiPost } from "../api/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SleepNight = {
  id: string;
  date: string; // "YYYY-MM-DD"
  totalSleepMinutes: number;
  remSleepMinutes: number;
  deepSleepMinutes: number;
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
  success: "#16A34A",
};

const GOAL_MINUTES = 8 * 60;

// --- helpers ---

function minutesToHoursLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

function ordinal(n: number) {
  if (!Number.isFinite(n)) return ""; // <- add this

  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatDateLabel(dateInput: string) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    // fallback so you see something instead of "NaNth"
    return dateInput;
  }

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

  const weekday = weekdays[d.getDay()];
  const monthName = months[d.getMonth()];
  const dayLabel = ordinal(d.getDate());

  return `${weekday} ${dayLabel} ${monthName}`;
}

function sleepQuality(total: number) {
  if (total < 7 * 60) return { label: "Short sleep", color: colors.error };
  if (total > 9 * 60) return { label: "Long sleep", color: colors.accent };
  return { label: "On target", color: colors.success };
}

// --- screen ---

export const MySleepScreen: React.FC = () => {
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // fake-night modal state
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

  function openFakeModal() {
    setFakeError(null);
    setFakeTotalHours("");
    setFakeTotalMinutes("");
    setFakeRemHours("");
    setFakeRemMinutes("");
    setFakeDeepHours("");
    setFakeDeepMinutes("");
    setFakeModalVisible(true);
  }

  function parseHoursMinutes(
    hoursStr: string,
    minutesStr: string,
    label: string
  ): number | null {
    const h = hoursStr.trim() === "" ? 0 : Number(hoursStr);
    const m = minutesStr.trim() === "" ? 0 : Number(minutesStr);

    if (
      !Number.isFinite(h) ||
      !Number.isFinite(m) ||
      h < 0 ||
      m < 0 ||
      m >= 60
    ) {
      setFakeError(`Enter valid ${label} hours and minutes (minutes 0–59).`);
      return null;
    }

    const total = h * 60 + m;
    if (total <= 0) {
      setFakeError(`${label} must be more than 0 minutes.`);
      return null;
    }

    return total;
  }

  function handleFakeSubmit() {
    setFakeError(null);

    const total = parseHoursMinutes(
      fakeTotalHours,
      fakeTotalMinutes,
      "total sleep"
    );
    if (total == null) return;

    const rem = parseHoursMinutes(fakeRemHours, fakeRemMinutes, "REM");
    if (rem == null) return;

    const deep = parseHoursMinutes(fakeDeepHours, fakeDeepMinutes, "Deep");
    if (deep == null) return;

    if (rem + deep > total) {
      setFakeError("REM + Deep cannot be more than total minutes.");
      return;
    }

    setFakeModalVisible(false);
    sendFakeNight(total, rem, deep);
  }

  useEffect(() => {
    load();
  }, []);

  const progressRatio =
    latestNight && latestNight.totalSleepMinutes > 0
      ? Math.min(1, latestNight.totalSleepMinutes / GOAL_MINUTES)
      : 0;

  const lightMinutes = latestNight
    ? Math.max(
        0,
        latestNight.totalSleepMinutes -
          latestNight.remSleepMinutes -
          latestNight.deepSleepMinutes
      )
    : 0;

  return (
    <View
      style={
        (styles.container, [styles.container, { paddingTop: 12 + insets.top }])
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>My Sleep</Text>
          <Text style={styles.subtitle}>Last 7 nights overview</Text>
        </View>
        <Pressable style={styles.addButton} onPress={openFakeModal}>
          <Text style={styles.addButtonIcon}>☾</Text>
          <Text style={styles.addButtonLabel}>
            {sending ? "Saving…" : "Add sleep"}
          </Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Today / last night summary */}
      {latestNight ? (
        <View style={styles.card}>
          {/* Card header */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardLabel}>Last night</Text>
              <Text style={styles.cardDate}>
                {formatDateLabel(latestNight.date)}
              </Text>
            </View>
            {(() => {
              const q = sleepQuality(latestNight.totalSleepMinutes);
              return (
                <View style={[styles.qualityPill, { borderColor: q.color }]}>
                  <View
                    style={[styles.qualityDot, { backgroundColor: q.color }]}
                  />
                  <Text style={[styles.qualityText, { color: q.color }]}>
                    {q.label}
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Big total + goal */}
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>
              {minutesToHoursLabel(latestNight.totalSleepMinutes)}
            </Text>
            <Text style={styles.totalSub}>
              Goal: {minutesToHoursLabel(GOAL_MINUTES)}
            </Text>
          </View>

          {/* Explicit metrics row */}
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

          {/* Goal progress bar */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressRatio * 100}%` },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabelText}>0 h</Text>
            <Text style={styles.progressLabelText}>8 h</Text>
          </View>

          {/* Sleep stages segmented bar */}
          <View style={styles.stagesContainer}>
            <View style={styles.stagesBar}>
              <View
                style={[
                  styles.stageSegment,
                  {
                    flex: latestNight.remSleepMinutes,
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              />
              <View
                style={[
                  styles.stageSegment,
                  {
                    flex: latestNight.deepSleepMinutes,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
              <View
                style={[
                  styles.stageSegment,
                  {
                    flex: lightMinutes,
                    backgroundColor: colors.surfaceMuted,
                  },
                ]}
              />
            </View>
            <View style={styles.stagesLegendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.primaryLight },
                  ]}
                />
                <Text style={styles.legendText}>REM</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: colors.accent }]}
                />
                <Text style={styles.legendText}>Deep</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                />
                <Text style={styles.legendText}>Other</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyText}>No sleep logged yet.</Text>
      )}

      {/* History list */}
      <Text style={styles.sectionTitle}>Last 7 nights</Text>
      <FlatList
        data={nights}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyDate}>
                {formatDateLabel(item.date)}
              </Text>
              <Text style={styles.historySubtitle}>
                {minutesToHoursLabel(item.totalSleepMinutes)} total
              </Text>
            </View>
            <View style={styles.historyMetric}>
              <Text style={styles.historyLabel}>REM</Text>
              <Text style={styles.historyValue}>
                {minutesToHoursLabel(item.remSleepMinutes)}
              </Text>
            </View>
            <View style={styles.historyMetric}>
              <Text style={styles.historyLabel}>Deep</Text>
              <Text style={styles.historyValue}>
                {minutesToHoursLabel(item.deepSleepMinutes)}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Fake night modal */}
      <Modal
        visible={fakeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFakeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add fake night</Text>
            <Text style={styles.modalSubtitle}>
              Enter hours and minutes for each stage.
            </Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Total sleep</Text>
              <View style={styles.modalInputRow}>
                <TextInput
                  value={fakeTotalHours}
                  onChangeText={setFakeTotalHours}
                  keyboardType="numeric"
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="h"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.modalInputSuffix}>h</Text>
                <TextInput
                  value={fakeTotalMinutes}
                  onChangeText={setFakeTotalMinutes}
                  keyboardType="numeric"
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="m"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.modalInputSuffix}>m</Text>
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>REM</Text>
              <View style={styles.modalInputRow}>
                <TextInput
                  value={fakeRemHours}
                  onChangeText={setFakeRemHours}
                  keyboardType="numeric"
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="h"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.modalInputSuffix}>h</Text>
                <TextInput
                  value={fakeRemMinutes}
                  onChangeText={setFakeRemMinutes}
                  keyboardType="numeric"
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="m"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.modalInputSuffix}>m</Text>
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Deep</Text>
              <View style={styles.modalInputRow}>
                <TextInput
                  value={fakeDeepHours}
                  onChangeText={setFakeDeepHours}
                  keyboardType="numeric"
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="h"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.modalInputSuffix}>h</Text>
                <TextInput
                  value={fakeDeepMinutes}
                  onChangeText={setFakeDeepMinutes}
                  keyboardType="numeric"
                  style={[styles.modalInput, styles.modalInputHalf]}
                  placeholder="m"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.modalInputSuffix}>m</Text>
              </View>
            </View>

            {fakeError ? (
              <Text style={styles.modalError}>{fakeError}</Text>
            ) : null}

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setFakeModalVisible(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleFakeSubmit}
              >
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  fakeLink: {
    color: colors.primaryLight,
    fontWeight: "500",
    fontSize: 13,
  },
  centerRow: {
    marginTop: 16,
    alignItems: "center",
  },
  error: {
    color: colors.error,
    marginTop: 8,
    fontSize: 13,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  qualityPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  qualityDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 6,
  },
  qualityText: {
    fontSize: 11,
    fontWeight: "600",
  },

  totalRow: {
    alignItems: "center",
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  totalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  metricCol: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  progressLabelText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  stagesContainer: {
    marginTop: 16,
  },
  stagesBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
  },
  stageSegment: {
    height: "100%",
  },
  stagesLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  emptyText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontSize: 14,
  },

  sectionTitle: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  historySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyMetric: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  historyLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  historyValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
  },

  // modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "90%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalError: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginLeft: 8,
  },
  modalButtonSecondary: {
    backgroundColor: "transparent",
  },
  modalButtonSecondaryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  addButtonIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  addButtonLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.primaryLight,
  },
  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalInputHalf: {
    flex: 1,
  },
  modalInputSuffix: {
    marginHorizontal: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
