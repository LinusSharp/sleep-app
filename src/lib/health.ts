import { NativeModules, Platform } from "react-native";
import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
} from "react-native-health";

const permissions: HealthKitPermissions = {
  permissions: {
    read: [AppleHealthKit?.Constants?.Permissions?.SleepAnalysis || 0],
    write: [],
  },
};

export const initHealthKit = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== "ios") {
      reject(new Error("HealthKit is only available on iOS"));
      return;
    }

    if (!NativeModules.AppleHealthKit) {
      reject(new Error("HealthKit native module is NOT installed."));
      return;
    }

    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        reject(new Error(error));
      } else {
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
  coreMinutes: number;
};

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const fetchLast7DaysSleep = (): Promise<AggregatedSleep[]> => {
  return new Promise((resolve, reject) => {
    const now = new Date();
    // Go back 9 days to ensure we catch the start of the week comfortably
    const startDate = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);

    const options = {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      limit: 2000, // Sufficient for sleep samples
    };

    AppleHealthKit.getSleepSamples(
      options,
      (err: Object, results: HealthValue[]) => {
        if (err) {
          reject(err);
          return;
        }

        const sleepMinutesMap = new Map<string, Set<number>>();
        const remMinutesMap = new Map<string, Set<number>>();
        const deepMinutesMap = new Map<string, Set<number>>();
        const coreMinutesMap = new Map<string, Set<number>>();

        results.forEach((sample) => {
          const start = new Date(sample.startDate);
          const end = new Date(sample.endDate);

          // --- FIX: Intelligent Date Grouping ---
          // Apple Health considers a sleep session ending at 7AM Sunday as "Sunday".
          // It ALSO considers the part of that session that happened Sat 11PM as "Sunday".
          // Rule: If a segment ends after 2 PM (14:00), it belongs to the NEXT day's session.
          // (e.g., a nap ending at 15:00 counts for tomorrow, or more likely, last night's sleep ends by morning)

          const endHour = end.getHours();
          let sessionDate = end;

          // If the segment ends late in the day (after 2 PM), treat it as the start of the next day's sleep
          if (endHour >= 14) {
            sessionDate = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          }

          const dateKey = getLocalDateString(sessionDate);

          // Prepare Sets
          if (!sleepMinutesMap.has(dateKey))
            sleepMinutesMap.set(dateKey, new Set());
          if (!remMinutesMap.has(dateKey))
            remMinutesMap.set(dateKey, new Set());
          if (!deepMinutesMap.has(dateKey))
            deepMinutesMap.set(dateKey, new Set());
          if (!coreMinutesMap.has(dateKey))
            coreMinutesMap.set(dateKey, new Set());

          const val = String(sample.value).toUpperCase();

          // Calculate minute timestamps
          const startMs = start.getTime();
          const endMs = end.getTime();

          for (let t = startMs; t < endMs; t += 60000) {
            const minuteTimestamp = Math.floor(t / 60000);

            // Matching Apple HealthKit Enum Values more robustly
            // 0: INBED, 1: ASLEEP, 2: AWAKE, 3: CORE, 4: DEEP, 5: REM

            // Check based on known strings or numeric values provided by library
            const isRem = val === "REM" || val === "ASLEEP_REM" || val === "5";
            const isDeep =
              val === "DEEP" || val === "ASLEEP_DEEP" || val === "4";
            const isCore =
              val === "CORE" || val === "ASLEEP_CORE" || val === "3";
            const isGenericAsleep = val === "ASLEEP" || val === "1";

            // NOTE: We specifically EXCLUDE "INBED" (0) and "AWAKE" (2) from totals

            if (isRem) remMinutesMap.get(dateKey)?.add(minuteTimestamp);
            if (isDeep) deepMinutesMap.get(dateKey)?.add(minuteTimestamp);
            if (isCore) coreMinutesMap.get(dateKey)?.add(minuteTimestamp);

            // Total Sleep = REM + Deep + Core + Generic Asleep
            if (isRem || isDeep || isCore || isGenericAsleep) {
              sleepMinutesMap.get(dateKey)?.add(minuteTimestamp);
            }
          }
        });

        const finalResults: AggregatedSleep[] = [];

        sleepMinutesMap.forEach((timestampSet, dateKey) => {
          // Filter out tiny false positives (less than 15 mins total sleep)
          if (timestampSet.size < 15) return;

          finalResults.push({
            date: dateKey,
            totalMinutes: timestampSet.size,
            remMinutes: remMinutesMap.get(dateKey)?.size || 0,
            deepMinutes: deepMinutesMap.get(dateKey)?.size || 0,
            coreMinutes: coreMinutesMap.get(dateKey)?.size || 0,
          });
        });

        finalResults.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        resolve(finalResults);
      }
    );
  });
};
