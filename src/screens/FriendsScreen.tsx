import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  FlatList,
  Alert,
  RefreshControl,
} from "react-native";
import { apiGet, apiPost } from "../api/client";

type Friend = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export const FriendsScreen: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);

  async function loadFriends() {
    setLoading(true);
    try {
      const res = await apiGet("/friends");
      setFriends(res.friends ?? []);
    } catch (err: any) {
      console.log(err);
      Alert.alert("Error", err.message ?? "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFriends();
  }, []);

  async function handleAddFriend() {
    if (!friendEmail.trim()) {
      Alert.alert("Error", "Enter a friend email");
      return;
    }
    setAddingFriend(true);
    try {
      await apiPost("/friends/add", { email: friendEmail.trim() });
      setFriendEmail("");
      await loadFriends();
      Alert.alert("Success", "Friend added");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to add friend");
    } finally {
      setAddingFriend(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add friend by email</Text>
        <TextInput
          style={styles.input}
          placeholder="friend@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={friendEmail}
          onChangeText={setFriendEmail}
        />
        <View style={styles.buttonRow}>
          <Button
            title={addingFriend ? "Adding..." : "Add friend"}
            onPress={handleAddFriend}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your friends</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadFriends} />
        }
        renderItem={({ item }) => {
          const name = item.displayName || item.email || "Unknown";
          return (
            <View style={styles.friendRow}>
              <Text style={styles.friendName}>{name}</Text>
              {item.email ? (
                <Text style={styles.friendEmail}>{item.email}</Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No friends yet.</Text>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  buttonRow: { marginTop: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  friendRow: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    borderRadius: 8,
  },
  friendName: { fontSize: 14, fontWeight: "600" },
  friendEmail: { fontSize: 12, color: "#666" },
  emptyText: { fontSize: 13, color: "#666", marginTop: 4 },
});
