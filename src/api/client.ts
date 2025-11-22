import { supabase } from "../lib/supabase";

// Change this to your laptop's LAN IP for local dev
const DEV_API_URL = "http://127.0.0.1:4000"; // <-- update the IP

// Production URL: Railway
const PROD_API_URL = "https://sleep-api-production.up.railway.app";

// Expo sets __DEV__ = true in development builds
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://sleep-api-production.up.railway.app";

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiGet(path: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No auth token");

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function apiPost(path: string, body: any) {
  const token = await getAccessToken();
  if (!token) throw new Error("No auth token");

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}
