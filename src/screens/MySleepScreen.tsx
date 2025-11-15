import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const MySleepScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Sleep</Text>
      <Text>Sleep stats will go here.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
});
