import { Platform } from "react-native";

// Safe import for react-native-health to handle different build environments
let AppleHealthKit: any;
try {
  // Try default export first
  AppleHealthKit = require("react-native-health").default;
  // Fallback if default is undefined but the module export isn't
  if (!AppleHealthKit) {
    AppleHealthKit = require("react-native-health");
  }
} catch (e) {
  console.log("Error requiring react-native-health:", e);
}

// Helper to check if module exists
function ensureHealthKit() {
  if (!AppleHealthKit || !AppleHealthKit.initHealthKit) {
    throw new Error(
      "HealthKit native module is not loaded. Please rebuild the app."
    );
  }
}

export const initHealthKit = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== "ios") {
      reject(new Error("HealthKit is only available on iOS"));
      return;
    }

    try {
      ensureHealthKit();

      // Define permissions here to avoid accessing Constants if module is undefined
      const permissions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.SleepAnalysis],
          write: [],
        },
      };

      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          reject(new Error(error));
        } else {
          resolve();
        }
      });
    } catch (err: any) {
      reject(err);
    }
  });
};

export type AggregatedSleep = {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  remMinutes: number;
  deepMinutes: number;
};

export const fetchLast7DaysSleep = (): Promise<AggregatedSleep[]> => {
  return new Promise((resolve, reject) => {
    try {
      ensureHealthKit();

      const options = {
        startDate: new Date(
          new Date().getTime() - 7 * 24 * 60 * 60 * 1000
        ).toISOString(), // 7 days ago
        endDate: new Date().toISOString(), // Now
        limit: 1000,
      };

      AppleHealthKit.getSleepSamples(options, (err: Object, results: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        // Map to store aggregated data by date
        const dailyMap = new Map<string, AggregatedSleep>();

        results.forEach((sample) => {
          const end = new Date(sample.endDate);
          const dateKey = end.toISOString().split("T")[0];

          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
              date: dateKey,
              totalMinutes: 0,
              remMinutes: 0,
              deepMinutes: 0,
            });
          }

          const entry = dailyMap.get(dateKey)!;
          const start = new Date(sample.startDate);
          const durationMinutes = (end.getTime() - start.getTime()) / 1000 / 60;

          // Cast value to string safely to avoid TS/Runtime mismatch
          const val = String(sample.value);

          // Logic to aggregate specific sleep stages
          if (val === "ASLEEP" || val === "INBED") {
            if (val === "ASLEEP") entry.totalMinutes += durationMinutes;
          }

          if (val === "ASLEEP_REM") {
            entry.remMinutes += durationMinutes;
            entry.totalMinutes += durationMinutes;
          }
          if (val === "ASLEEP_DEEP") {
            entry.deepMinutes += durationMinutes;
            entry.totalMinutes += durationMinutes;
          }
          if (val === "ASLEEP_CORE") {
            entry.totalMinutes += durationMinutes;
          }
        });

        const result = Array.from(dailyMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        resolve(result);
      });
    } catch (err: any) {
      reject(err);
    }
  });
};
