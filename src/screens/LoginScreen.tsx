import React, { useState } from "react";
import { View, Text, Button, StyleSheet, TextInput, Alert } from "react-native";
import { supabase } from "../lib/supabase";

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Login failed", error.message);
    }
    // on success, App.tsx will switch to MainTabs via auth state listener
  }

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert("Check your email", "Confirm your address then log in.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sleep App</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.buttonRow}>
        <Button title={loading ? "..." : "Login"} onPress={handleLogin} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Sign up" onPress={handleSignUp} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  buttonRow: {
    marginVertical: 4,
  },
});
