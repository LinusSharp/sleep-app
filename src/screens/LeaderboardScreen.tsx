import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const LeaderboardScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      <Text>Leaderboard will go here.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
});
