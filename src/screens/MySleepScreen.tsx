// --- START OF FILE MySleepScreen.tsx ---

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Linking, // <--- Added Linking
} from "react-native";
import { apiGet, apiPost } from "../api/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { initHealthKit, fetchLast7DaysSleep } from "../lib/health";

// --- Types ---

type SleepNight = {
  id: string;
  date: string;
  totalSleepMinutes: number;
  remSleepMinutes: number;
  deepSleepMinutes: number;
};

// --- Logic Helpers ---

const GOAL_MINUTES = 8 * 60;

function calculateScore(totalMinutes: number) {
  const score = Math.round((totalMinutes / GOAL_MINUTES) * 100);
  return score > 100 ? 100 : score;
}

function getRankTier(score: number) {
  if (score >= 100) return { label: "DIAMOND", color: "#22D3EE" };
  if (score >= 90) return { label: "PLATINUM", color: "#A78BFA" };
  if (score >= 75) return { label: "GOLD", color: "#FBBF24" };
  if (score >= 50) return { label: "SILVER", color: "#94A3B8" };
  return { label: "BRONZE", color: "#475569" };
}

function minutesToHoursLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
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

// Helper to handle date manipulation without timezone headaches
function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// --- Main Component ---

export const MySleepScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [nights, setNights] = useState<SleepNight[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fakeModalVisible, setFakeModalVisible] = useState(false);
  // APPLE COMPLIANCE: Privacy Disclosure State
  const [healthDisclosureVisible, setHealthDisclosureVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  // Manual Log State
  const [fakeTotalHours, setFakeTotalHours] = useState("");
  const [fakeTotalMinutes, setFakeTotalMinutes] = useState("");
  const [fakeRemHours, setFakeRemHours] = useState("");
  const [fakeRemMinutes, setFakeRemMinutes] = useState("");
  const [fakeDeepHours, setFakeDeepHours] = useState("");
  const [fakeDeepMinutes, setFakeDeepMinutes] = useState("");
  const [fakeError, setFakeError] = useState<string | null>(null);

  // Date Selection for Manual Log
  const [manualDate, setManualDate] = useState(new Date());

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

  // --- Date Helpers for Modal ---

  function changeManualDate(days: number) {
    const newDate = new Date(manualDate);
    newDate.setDate(newDate.getDate() + days);

    // Prevent future dates
    if (newDate > new Date()) return;

    setManualDate(newDate);
  }

  function getManualDateLabel() {
    const today = stripTime(new Date());
    const selected = stripTime(manualDate);

    if (selected.getTime() === today.getTime()) return "Today";

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (selected.getTime() === yesterday.getTime()) return "Yesterday";

    return formatDateLabel(selected.toISOString());
  }

  // --- Apple Health Sync Logic ---

  function initiateSyncSequence() {
    if (Platform.OS !== "ios") {
      Alert.alert("Not Supported", "Health sync is only available on iOS.");
      return;
    }
    setHealthDisclosureVisible(true);
  }

  async function performHealthSync() {
    setHealthDisclosureVisible(false); // Close modal
    setSyncing(true);

    try {
      // 1. Initialize with Timeout Safety
      // If user closes the permission prompt on iOS without action, it might hang in some library versions.
      const initPromise = initHealthKit();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("HealthKit initialization timed out")),
          10000
        )
      );

      await Promise.race([initPromise, timeoutPromise]);

      // 2. Fetch Data
      const healthData = await fetchLast7DaysSleep();

      // 3. Handle Missing Data / Permissions Issue
      // If array is empty, it usually means permissions are Denied or user has no data.
      if (healthData.length === 0) {
        Alert.alert(
          "No Data Found",
          "We couldn't find any sleep records. This usually happens if:\n\n1. You haven't tracked sleep.\n2. You denied Health permissions.\n\nTo allow access, open Settings > Health > Data Access > SlumberLeague.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        setSyncing(false);
        return;
      }

      // 4. Upload Data
      let uploadedCount = 0;
      for (const night of healthData) {
        const total = Math.round(night.totalMinutes);
        const rem = Math.round(night.remMinutes);
        const deep = Math.round(night.deepMinutes);

        if (total > 0) {
          await apiPost("/sleep/upload", {
            date: night.date,
            totalSleepMinutes: total,
            remSleepMinutes: rem,
            deepSleepMinutes: deep,
          });
          uploadedCount++;
        }
      }

      await load();

      const latest = healthData[0];
      Alert.alert(
        "Sync Complete",
        `Synced ${uploadedCount} nights.\n\nLatest (${
          latest.date
        }):\nTotal: ${minutesToHoursLabel(
          latest.totalMinutes
        )}\nREM: ${minutesToHoursLabel(
          latest.remMinutes
        )}\nDeep: ${minutesToHoursLabel(latest.deepMinutes)}`
      );
    } catch (err: any) {
      console.log("Sync Error:", err);
      // Clean up error message for user
      const msg = err.message.includes("timed out")
        ? "Sync timed out. Please check if a permission dialog is open or try again."
        : err.message;

      Alert.alert("Sync Failed", msg);
    } finally {
      setSyncing(false);
    }
  }

  async function sendFakeNight(
    date: Date,
    total: number,
    rem: number,
    deep: number
  ) {
    setSending(true);
    setError(null);
    try {
      // Create local YYYY-MM-DD string to avoid timezone shifts
      const offset = date.getTimezoneOffset() * 60000;
      const localISODate = new Date(date.getTime() - offset)
        .toISOString()
        .split("T")[0];

      await apiPost("/sleep/upload", {
        date: localISODate,
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
    sendFakeNight(manualDate, total, rem, deep);
  }

  const renderHeroCard = () => {
    if (!latestNight) {
      return (
        <View style={styles.emptyHero}>
          <Ionicons name="moon" size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyHeroText}>No sleep data recorded.</Text>
          <View style={styles.emptyButtons}>
            <Pressable
              style={styles.ctaButton}
              onPress={() => setFakeModalVisible(true)}
            >
              <Text style={styles.ctaButtonText}>Log Manually</Text>
            </Pressable>
            <Pressable
              style={[styles.ctaButton, styles.ctaButtonSecondary]}
              onPress={initiateSyncSequence}
            >
              {syncing ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.ctaButtonText,
                    { color: theme.colors.primary },
                  ]}
                >
                  Sync Health
                </Text>
              )}
            </Pressable>
          </View>
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

        <View style={styles.scoreSection}>
          <Text style={styles.scoreLabel}>Daily Score</Text>
          <Text style={[styles.scoreValue, { color: rank.color }]}>
            {score}
          </Text>
        </View>

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
    const lightSleep = Math.max(
      0,
      item.totalSleepMinutes - item.remSleepMinutes - item.deepSleepMinutes
    );

    return (
      <View style={styles.historyRow}>
        <View
          style={[styles.historyIndicator, { backgroundColor: rank.color }]}
        />
        <View style={styles.historyContent}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={styles.historyDate}>
                {formatDateLabel(item.date)}
              </Text>
              <Text style={styles.historyValue}>
                {minutesToHoursLabel(item.totalSleepMinutes)}
              </Text>
            </View>

            <Text style={styles.historySubText}>
              {rank.label} • {score} pts
            </Text>

            <View style={styles.statsRowSmall}>
              <Text style={styles.statTextSmall}>
                <Text style={{ color: theme.colors.accent }}>
                  REM: {minutesToHoursLabel(item.remSleepMinutes)}
                </Text>
                {"  •  "}
                <Text style={{ color: theme.colors.success }}>
                  Deep: {minutesToHoursLabel(item.deepSleepMinutes)}
                </Text>
                {"  •  "}
                <Text style={{ color: theme.colors.textSecondary }}>
                  Light: {minutesToHoursLabel(lightSleep)}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: 12 + insets.top }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your recovery</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            onPress={initiateSyncSequence}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="sync" size={22} color={theme.colors.primary} />
            )}
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={() => setInfoVisible(true)}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.colors.textSecondary}
            />
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={() => {
              setManualDate(new Date()); // Reset to today
              setFakeModalVisible(true);
            }}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </Pressable>
        </View>
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
        {renderHeroCard()}
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

        <View style={styles.medicalDisclaimerContainer}>
          <Ionicons
            name="medical-outline"
            size={16}
            color={theme.colors.textTertiary}
          />
          <Text style={styles.medicalDisclaimerText}>
            SlumberLeague is for entertainment and fitness tracking purposes
            only. It is not a medical device.
          </Text>
        </View>
      </ScrollView>

      {/* Manual Entry Modal */}
      <Modal
        visible={fakeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFakeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalHeader}>Log Session</Text>
              <Text style={styles.modalSub}>
                For users without wearable devices.
              </Text>

              {/* DATE SELECTOR */}
              <View style={styles.dateSelector}>
                <Pressable
                  onPress={() => changeManualDate(-1)}
                  style={styles.dateArrow}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>

                <Text style={styles.dateText}>{getManualDateLabel()}</Text>

                <Pressable
                  onPress={() => changeManualDate(1)}
                  style={[
                    styles.dateArrow,
                    stripTime(manualDate).getTime() ===
                      stripTime(new Date()).getTime() && { opacity: 0.3 },
                  ]}
                  disabled={
                    stripTime(manualDate).getTime() ===
                    stripTime(new Date()).getTime()
                  }
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.textPrimary}
                  />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Duration</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder="08"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={fakeTotalHours}
                    onChangeText={setFakeTotalHours}
                    returnKeyType="done"
                  />
                  <Text style={styles.unit}>h</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={fakeTotalMinutes}
                    onChangeText={setFakeTotalMinutes}
                    returnKeyType="done"
                  />
                  <Text style={styles.unit}>m</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REM Sleep</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder="02"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={fakeRemHours}
                    onChangeText={setFakeRemHours}
                    returnKeyType="done"
                  />
                  <Text style={styles.unit}>h</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="00"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={fakeRemMinutes}
                    onChangeText={setFakeRemMinutes}
                    returnKeyType="done"
                  />
                  <Text style={styles.unit}>m</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Deep Sleep</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder="01"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={fakeDeepHours}
                    onChangeText={setFakeDeepHours}
                    returnKeyType="done"
                  />
                  <Text style={styles.unit}>h</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="45"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="number-pad"
                    value={fakeDeepMinutes}
                    onChangeText={setFakeDeepMinutes}
                    returnKeyType="done"
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
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Info/Privacy Modals remain unchanged */}
      <Modal
        visible={healthDisclosureVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHealthDisclosureVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* ... content same as before ... */}
            <Text style={styles.modalHeader}>Health Data Privacy</Text>
            <Text style={styles.modalSub}>
              To participate in the leaderboards, SlumberLeague needs to upload
              your sleep duration data to our secure servers.
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setHealthDisclosureVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={performHealthSync} style={styles.saveBtn}>
                <Text style={styles.saveText}>Agree & Sync</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infoCard}>
            <Text style={styles.modalHeader}>Scoring System</Text>
            <ScrollView>
              <View style={styles.infoRow}>
                <Text style={styles.rankTextInfo}>
                  <Text style={{ color: "#22D3EE" }}>DIAMOND</Text>: 100+ Score
                  (8h+)
                </Text>
              </View>
              {/* ... */}
            </ScrollView>
            <Pressable
              style={styles.closeInfoBtn}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.closeInfoText}>Close</Text>
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
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
  },
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 8,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 99,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
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
  emptyButtons: {
    flexDirection: "row",
    gap: 12,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaButtonSecondary: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ctaButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },
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
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: "60%",
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
    lineHeight: 20,
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
  infoRow: {
    marginBottom: 12,
  },
  rankTextInfo: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },
  infoDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  closeInfoBtn: {
    marginTop: 24,
    alignItems: "center",
    padding: 12,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 12,
  },
  closeInfoText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  statsRowSmall: {
    marginTop: 6,
  },
  statTextSmall: {
    fontSize: 11,
    fontWeight: "500",
  },
  medicalDisclaimerContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    opacity: 0.8,
  },
  medicalDisclaimerText: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.textTertiary,
    lineHeight: 15,
  },
  // Date Selector Styles
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateArrow: {
    padding: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
});
