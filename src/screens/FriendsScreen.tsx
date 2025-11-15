import React from "react";
import { View, Text, StyleSheet, Button, Alert } from "react-native";
import { supabase } from "../lib/supabase";

export const FriendsScreen: React.FC = () => {
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Logout failed", error.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends / Profile</Text>
      <Text>Friends list / profile settings will go here.</Text>
      <View style={{ marginTop: 24 }}>
        <Button title="Logout" onPress={handleLogout} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
});
