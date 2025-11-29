import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  Pressable,
  Animated,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

type OnboardingItem = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const SLIDES: OnboardingItem[] = [
  {
    id: "1",
    title: "Sync Your Sleep",
    description:
      "SlumberLeague connects with Apple Health to track your sleep automatically. Please allow permissions when prompted to get your score.",
    icon: "heart-circle",
    color: "#EF4444", // Red/Pink like Health
  },
  {
    id: "2",
    title: "Join a Clan",
    description:
      "Sleep is better with backup. Join an existing Squad or create your own to compete on the leaderboards together.",
    icon: "shield-checkmark",
    color: theme.colors.primary,
  },
  {
    id: "3",
    title: "Climb the Ranks",
    description:
      "Earn points for duration, REM, and Deep sleep. Compete daily for the Gold rank and weekly glory.",
    icon: "trophy",
    color: "#FBBF24", // Gold
  },
];

interface Props {
  onFinish: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({ onFinish }) => {
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      onFinish();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.color + "20" },
                ]}
              >
                <Ionicons name={item.icon} size={100} color={item.color} />
              </View>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        {/* Paginator Dots */}
        <View style={styles.paginator}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentIndex
                      ? theme.colors.primary
                      : theme.colors.border,
                  width: i === currentIndex ? 20 : 10,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <Pressable onPress={onFinish} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          <Pressable onPress={handleNext} style={styles.nextBtn}>
            <Text style={styles.nextText}>
              {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
            </Text>
            {currentIndex !== SLIDES.length - 1 && (
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconContainer: {
    flex: 0.5,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  content: {
    flex: 0.4,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    height: 120,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  paginator: {
    flexDirection: "row",
    justifyContent: "center",
    height: 20,
    gap: 8,
  },
  dot: {
    height: 10,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  skipBtn: {
    padding: 12,
  },
  skipText: {
    color: theme.colors.textTertiary,
    fontWeight: "600",
    fontSize: 16,
  },
  nextBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
