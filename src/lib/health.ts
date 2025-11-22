import { NativeModules, Platform } from "react-native";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
} from "react-native-health";

// --- DEBUG LOGGING ---
console.log("--------------------------------------");
console.log("DEBUG: Checking Native Modules...");
if (NativeModules.AppleHealthKit) {
  console.log("DEBUG: NativeModules.AppleHealthKit EXISTS ✅");
} else {
  console.log("DEBUG: NativeModules.AppleHealthKit is MISSING ❌");
  console.log("DEBUG: Available Modules:", Object.keys(NativeModules));
}
// ---------------------

const permissions: HealthKitPermissions = {
  permissions: {
    read: [AppleHealthKit?.Constants?.Permissions?.SleepAnalysis || 0], // Safe access
    write: [],
  },
};

export const initHealthKit = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== "ios") {
      reject(new Error("HealthKit is only available on iOS"));
      return;
    }

    // 1. Direct Native Module Check (The most reliable check)
    if (!NativeModules.AppleHealthKit) {
      reject(
        new Error(
          "HealthKit native module is NOT installed in this build. Are you in Expo Go?"
        )
      );
      return;
    }

    // 2. Initialize
    // Sometimes the import is 'AppleHealthKit.default', so we try both
    const HK = AppleHealthKit;

    if (!HK || !HK.initHealthKit) {
      reject(new Error("HealthKit JS object is empty. Check imports."));
      return;
    }

    HK.initHealthKit(permissions, (error: string) => {
      if (error) {
        reject(new Error(error));
      } else {
        console.log("DEBUG: HealthKit Initialized Successfully!");
        resolve();
      }
    });
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
    // Configure fetch options
    const options = {
      startDate: new Date(
        new Date().getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      endDate: new Date().toISOString(),
      limit: 1000, // High limit to catch all fragments
    };

    AppleHealthKit.getSleepSamples(
      options,
      (err: Object, results: HealthValue[]) => {
        if (err) {
          reject(err);
          return;
        }

        // Map to store aggregated data by date
        const dailyMap = new Map<string, AggregatedSleep>();

        results.forEach((sample) => {
          const end = new Date(sample.endDate);
          // Group by the date the sleep ENDED (the morning of)
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

          const val = String(sample.value);

          // Apple Health Values:
          // 'INBED', 'ASLEEP', 'AWAKE'
          // 'ASLEEP_CORE', 'ASLEEP_DEEP', 'ASLEEP_REM'

          // General Sleep
          if (val === "ASLEEP") {
            entry.totalMinutes += durationMinutes;
          }

          // Specific Stages (adds to total AND specific buckets)
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

        // Sort newest first
        const result = Array.from(dailyMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        resolve(result);
      }
    );
  });
};
