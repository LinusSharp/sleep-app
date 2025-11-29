import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Clipboard,
  Animated,
  Platform,
  UIManager,
  TouchableOpacity,
  LayoutAnimation,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, apiPost } from "../api/client";
import { theme } from "../theme";
import { Ionicons } from "@expo/vector-icons";

// Enable LayoutAnimation
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- CONSTANTS ---
const CATEGORIES = [
  { id: "hibernator", label: "Hibernator", icon: "snow-outline" },
  { id: "survivalist", label: "Survivalist", icon: "battery-charging-outline" },
  { id: "tomRemmer", label: "Top REM'er", icon: "flash-outline" },
  { id: "rollingInTheDeep", label: "Rolling in the deep", icon: "bed-outline" },
];

const TIER_COLORS = [
  "#A16207", // 0: Fallback
  "#CD7F32", // 1: Bronze
  "#94A3B8", // 2: Silver
  "#FBBF24", // 3: Gold
  "#22D3EE", // 4: Diamond
  "#A78BFA", // 5: Mythic (Purple)
];

const getTierInfo = (tier: number) => {
  const color = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
  const label =
    tier === 1
      ? "I"
      : tier === 2
      ? "II"
      : tier === 3
      ? "III"
      : tier === 4
      ? "IV"
      : tier === 5
      ? "V"
      : "MAX";

  return { color, label };
};

// --- ANIMATION WRAPPER ---
const FadeInView = ({ children, delay = 0, style }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
};

// --- TYPES ---
type LeaderboardEntry = {
  userId: string;
  displayName: string | null;
  points: number;
  value: number;
  nightsLogged: number;
};

// --- SUB-COMPONENT: MVP BADGE ---
const MVPBadge = ({
  title,
  icon,
  user,
  color,
}: {
  title: string;
  icon: any;
  user: LeaderboardEntry;
  color: string;
}) => {
  if (!user) return null;
  return (
    <View style={[styles.mvpCard, { borderColor: color }]}>
      <View style={[styles.mvpIconCircle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#FFF" />
      </View>
      <Text style={[styles.mvpTitle, { color }]}>{title}</Text>
      <Text style={styles.mvpName} numberOfLines={1}>
        {user.displayName || "Unknown"}
      </Text>
      <Text style={styles.mvpPoints}>{user.points} pts</Text>
    </View>
  );
};

// --- MAIN COMPONENT ---
export const ClanScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // State
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"hq" | "archives">("hq");

  // Data
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState("hibernator");

  // Forms
  const [joinCode, setJoinCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [newName, setNewName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- LOADING ---
  async function loadData() {
    setLoading(true);
    try {
      const [dashRes, historyRes] = await Promise.all([
        apiGet("/groups/dashboard"),
        apiGet("/leaderboard?scope=clan&offset=1"),
      ]);

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setData(dashRes);
      setHistory(historyRes.leaderboards);

      if (dashRes.group?.name) {
        setNewName(dashRes.group.name);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // --- ACTIONS ---
  async function handleJoin() {
    if (!joinCode) return;
    setActionLoading(true);
    try {
      await apiPost("/groups/join", { code: joinCode.toUpperCase() });
      setJoinCode("");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreate() {
    if (!createName) return;
    setActionLoading(true);
    try {
      await apiPost("/groups/create", { name: createName });
      setCreateName("");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRename() {
    if (!newName || newName.length < 3)
      return Alert.alert("Too Short", "Name must be 3+ characters.");
    setActionLoading(true);
    try {
      await apiPost("/groups/rename", { name: newName });
      setData((prev: any) => ({
        ...prev,
        group: { ...prev.group, name: newName },
      }));
      setIsEditing(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    Alert.alert(
      "Resign from Clan?",
      "You will lose access to team achievements and history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resign",
          style: "destructive",
          onPress: async () => {
            await apiPost("/groups/leave", {});
            setData({ isInClan: false });
            loadData();
          },
        },
      ]
    );
  }

  const copyCode = () => {
    Clipboard.setString(data.group.code);
    Alert.alert("Copied", "Clan code copied to clipboard.");
  };

  // --- HELPERS ---
  const getRankStyle = (rank: number) => {
    if (rank === 1) return { color: "#FBBF24", bg: "rgba(251, 191, 36, 0.1)" };
    if (rank === 2) return { color: "#94A3B8", bg: "rgba(148, 163, 184, 0.1)" };
    if (rank === 3) return { color: "#B45309", bg: "rgba(180, 83, 9, 0.1)" };
    return { color: theme.colors.textSecondary, bg: "transparent" };
  };

  const minsToHrs = (mins: number) => Math.round((mins / 60) * 10) / 10 + "h";

  // --- RENDERERS ---

  const renderJoinScreen = () => (
    <ScrollView contentContainerStyle={styles.joinContainer}>
      <FadeInView>
        <View style={styles.heroBox}>
          <View style={styles.emblemContainer}>
            <Ionicons name="shield-half" size={64} color="#FFF" />
          </View>
          <Text style={styles.heroTitle}>Squad Up</Text>
          <Text style={styles.heroSub}>
            Sleep is better with backup. Create a clan or join an existing
            squad.
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={100} style={styles.actionCard}>
        <Text style={styles.cardHeader}>Have an Invite?</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. PZR1QW11"
            placeholderTextColor={theme.colors.textTertiary}
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
          />
          <Pressable
            style={styles.goBtn}
            onPress={handleJoin}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Ionicons name="arrow-forward" size={24} color="#FFF" />
            )}
          </Pressable>
        </View>
      </FadeInView>

      <FadeInView delay={200} style={styles.actionCard}>
        <Text style={styles.cardHeader}>Start a New Clan</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Clan Name"
            placeholderTextColor={theme.colors.textTertiary}
            value={createName}
            onChangeText={setCreateName}
            maxLength={15}
          />
          <Pressable
            style={[styles.goBtn, { backgroundColor: theme.colors.success }]}
            onPress={handleCreate}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Ionicons name="add" size={24} color="#FFF" />
            )}
          </Pressable>
        </View>
      </FadeInView>
    </ScrollView>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.bannerContainer}>
        <View style={styles.bannerIcon}>
          <Ionicons name="shield" size={40} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.editInput}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <Pressable
                  onPress={handleRename}
                  disabled={actionLoading}
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={28}
                    color={theme.colors.success}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setIsEditing(false)}
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name="close-circle"
                    size={28}
                    color={theme.colors.error}
                  />
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.clanName} numberOfLines={1}>
                  {data.group.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name="pencil"
                    size={14}
                    color={theme.colors.textTertiary}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.clanStats}>
            {data.group.memberCount} Members • {data.stats.totalHours}h Total
            Sleep
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.inviteTicket} onPress={copyCode}>
        <View style={styles.ticketLeft}>
          <Text style={styles.ticketLabel}>INVITE CODE</Text>
          <Text style={styles.ticketCode}>{data.group.code}</Text>
        </View>
        <View style={styles.ticketRight}>
          <Ionicons name="copy-outline" size={20} color="#FFF" />
        </View>
      </TouchableOpacity>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "hq" && styles.tabActive]}
          onPress={() => setActiveTab("hq")}
        >
          <Text
            style={[styles.tabText, activeTab === "hq" && styles.tabTextActive]}
          >
            HQ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "archives" && styles.tabActive]}
          onPress={() => setActiveTab("archives")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "archives" && styles.tabTextActive,
            ]}
          >
            Archives
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHQ = () => {
    // Dynamic Data from Backend
    const squadLevel = data.squadLevel || {
      current: 1,
      progress: 0,
      target: 50,
    };

    // Calculate progress relative to current tier gap
    // Backend sends cumulative target.
    // Example: Tier 1 Target 50. Tier 2 Target 100.
    // If current = 60. We are Tier 2.
    // Previous Tier Target = (2-1) * (Target/2) = 50.
    // Progress in Tier 2 = 60 - 50 = 10.
    // Gap = 100 - 50 = 50.
    // Percent = 10/50.

    // Let's simplify:
    const levelBase = squadLevel.target / squadLevel.current; // Estimate base from target
    const prevTarget = (squadLevel.current - 1) * levelBase;
    const progressInTier = squadLevel.progress - prevTarget;
    const tierGap = squadLevel.target - prevTarget;
    const progressPercent = Math.min(
      100,
      Math.max(0, (progressInTier / tierGap) * 100)
    );

    return (
      <View style={{ paddingHorizontal: 24, paddingBottom: 100 }}>
        {/* 1. SQUAD LEVEL CARD */}
        <FadeInView style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.levelLabel}>SQUAD LEVEL</Text>
              <Text style={styles.levelValue}>{squadLevel.current}</Text>
            </View>
            <View style={styles.levelIconBox}>
              <Ionicons name="star" size={24} color="#FBBF24" />
            </View>
          </View>
          <View style={styles.levelProgressBg}>
            <View
              style={[
                styles.levelProgressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
          <Text style={styles.levelSub}>
            {Math.floor(progressInTier)} / {tierGap} nights to Level{" "}
            {squadLevel.current + 1}
          </Text>
        </FadeInView>

        {/* 2. HALL OF FAME */}
        {history && (
          <FadeInView delay={100} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="trophy" size={18} color="#FBBF24" />
              <Text style={styles.sectionTitle}>LAST WEEK'S HALL OF FAME</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 24 }}
            >
              <MVPBadge
                title="Survivalist"
                icon="battery-charging"
                user={history.survivalist[0]}
                color="#FBBF24"
              />
              <MVPBadge
                title="Hibernator"
                icon="snow"
                user={history.hibernator[0]}
                color="#22D3EE"
              />
              <MVPBadge
                title="Top REM'er"
                icon="flash"
                user={history.tomRemmer[0]}
                color="#A78BFA"
              />
              <MVPBadge
                title="Rolling Deep"
                icon="bed"
                user={history.rollingInTheDeep[0]}
                color="#34D399"
              />
              {!history.survivalist[0] &&
                !history.hibernator[0] &&
                !history.tomRemmer[0] && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      No champions recorded last week.
                    </Text>
                  </View>
                )}
            </ScrollView>
          </FadeInView>
        )}

        {/* 3. CLAN QUESTS (DYNAMIC TIERS) */}
        <FadeInView delay={200}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="map" size={18} color={theme.colors.textSecondary} />
            <Text style={styles.sectionTitle}>CLAN QUESTS</Text>
          </View>

          <View style={{ gap: 12, marginBottom: 32 }}>
            {data.achievements.map((ach: any, i: number) => {
              // Calculate Tier-Specific Progress
              // Logic similar to Squad Level but handled here visually
              // Backend returns 'tier', 'current' (cumulative), 'target' (cumulative)
              // We need to calculate the progress bar just for THIS tier.

              // Estimate base target per tier
              const estimatedBase = ach.target / ach.tier;
              const prevTierTarget = (ach.tier - 1) * estimatedBase;

              const currentInTier = ach.current - prevTierTarget;
              const targetInTier = ach.target - prevTierTarget;

              const progress = Math.min(
                100,
                Math.max(0, (currentInTier / targetInTier) * 100)
              );

              const tierInfo = getTierInfo(ach.tier);

              return (
                <View
                  key={i}
                  style={[
                    styles.questRow,
                    { borderColor: tierInfo.color, borderWidth: 1 },
                  ]}
                >
                  {/* Tier Badge */}
                  <View
                    style={[
                      styles.questTierBadge,
                      { backgroundColor: tierInfo.color },
                    ]}
                  >
                    <Text style={styles.questTierText}>{tierInfo.label}</Text>
                  </View>

                  <View
                    style={[
                      styles.questIcon,
                      { backgroundColor: theme.colors.surfaceHighlight },
                    ]}
                  >
                    <Ionicons
                      name={ach.icon as any}
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text style={styles.questName}>{ach.name}</Text>
                      {/* Only show checkmark if we are somehow "maxed" or visually distinct for completion, 
                          but since it's endless, we show the Tier instead */}
                    </View>
                    <Text style={styles.questDesc}>{ach.description}</Text>

                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${progress}%`,
                            backgroundColor: tierInfo.color,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.questProgress}>
                      {Math.floor(currentInTier)} / {Math.floor(targetInTier)}{" "}
                      {ach.unit}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </FadeInView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color={theme.colors.error}
            />
            <Text style={styles.leaveText}>Resign Commission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderArchives = () => {
    const list: LeaderboardEntry[] = history?.[selectedCategory] || [];
    const hasData = list.length > 0;

    return (
      <View style={{ paddingBottom: 100 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catChip,
                selectedCategory === cat.id && styles.catChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={
                  selectedCategory === cat.id
                    ? "#FFF"
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.catText,
                  selectedCategory === cat.id && styles.catTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 24 }}>
          {!hasData ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="time-outline"
                size={48}
                color={theme.colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptySub}>
                No winners were recorded for last week.
              </Text>
            </View>
          ) : (
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.thRank}>#</Text>
                <Text style={styles.thName}>PLAYER</Text>
                <Text style={styles.thVal}>PTS</Text>
                <Text style={styles.thVal}>VAL</Text>
              </View>
              {list.map((user, index) => {
                const rank = index + 1;
                const style = getRankStyle(rank);
                return (
                  <View
                    key={user.userId}
                    style={[
                      styles.tableRow,
                      index !== list.length - 1 && styles.tableRowBorder,
                    ]}
                  >
                    <View
                      style={[styles.rankBadge, { backgroundColor: style.bg }]}
                    >
                      <Text style={[styles.rankText, { color: style.color }]}>
                        {rank}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.tableName} numberOfLines={1}>
                        {user.displayName || "Unknown"}
                      </Text>
                      <Text style={styles.tableSub}>
                        {user.nightsLogged} nights
                      </Text>
                    </View>
                    <Text style={styles.tablePoints}>{user.points}</Text>
                    <Text style={styles.tableValue}>
                      {minsToHrs(user.value)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {!data?.isInClan ? (
        renderJoinScreen()
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 10 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadData} />
          }
        >
          {renderHeader()}
          {activeTab === "hq" ? renderHQ() : renderArchives()}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  joinContainer: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  heroBox: { alignItems: "center", marginBottom: 40 },
  emblemContainer: {
    width: 100,
    height: 100,
    backgroundColor: theme.colors.primary,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  inputRow: { flexDirection: "row", gap: 12 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 16,
  },
  goBtn: {
    width: 54,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingHorizontal: 24, marginBottom: 24 },
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  bannerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  clanName: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },
  clanStats: { fontSize: 14, color: theme.colors.textSecondary },
  editContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  editInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    paddingVertical: 2,
  },
  iconBtn: { padding: 4 },
  inviteTicket: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginBottom: 24,
  },
  ticketLeft: {
    flex: 1,
    padding: 12,
    paddingLeft: 16,
    justifyContent: "center",
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  ticketCode: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  ticketRight: {
    width: 50,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: 12,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: theme.colors.surfaceHighlight },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  tabTextActive: { color: theme.colors.textPrimary, fontWeight: "700" },
  levelCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 32,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  levelValue: {
    fontSize: 32,
    fontWeight: "900",
    color: theme.colors.textPrimary,
  },
  levelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelProgressBg: {
    height: 8,
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  levelProgressFill: {
    height: "100%",
    backgroundColor: "#FBBF24",
    borderRadius: 4,
  },
  levelSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  section: { marginBottom: 32 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textTertiary,
    letterSpacing: 1,
  },
  mvpCard: {
    width: 130,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    marginRight: 0,
  },
  mvpIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mvpTitle: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  mvpName: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginBottom: 2,
    textAlign: "center",
  },
  mvpPoints: { fontSize: 11, color: theme.colors.textSecondary },
  emptyCard: { padding: 12, alignItems: "center", justifyContent: "center" },
  emptyText: {
    color: theme.colors.textTertiary,
    fontStyle: "italic",
    fontSize: 12,
  },

  // QUESTS
  questRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  questTierBadge: {
    position: "absolute",
    top: -8,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  questTierText: { fontSize: 10, fontWeight: "900", color: "#000" },
  questIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  questName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  questDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    marginBottom: 6,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 3 },
  questProgress: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: "600",
    alignSelf: "flex-end",
  },

  // ARCHIVES
  catScroll: { paddingHorizontal: 24, gap: 8, marginBottom: 24 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
  catTextActive: { color: "#FFF" },
  tableCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceHighlight,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  thRank: {
    width: 32,
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  thName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  thVal: {
    width: 40,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  tableRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 12, fontWeight: "800" },
  tableName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  tableSub: { fontSize: 12, color: theme.colors.textTertiary },
  tablePoints: {
    width: 40,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  tableValue: {
    width: 40,
    textAlign: "right",
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  footer: { paddingHorizontal: 24, alignItems: "center" },
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  leaveText: { color: theme.colors.error, fontWeight: "700", marginLeft: 8 },
});
