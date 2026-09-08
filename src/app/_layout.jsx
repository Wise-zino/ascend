import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDB } from "../../database/client";
import { PenaltyRewardService } from "@/utils/penaltyRewardService";

const NAME_STORAGE_KEY = 'username';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
      (async () => {
        try {
          await getDB(); // opens db, runs migrations

          // Decide destination BEFORE catch-up runs, so awaySummary
          // knows where "Continue" should send the user afterward.
          const savedName = await AsyncStorage.getItem(NAME_STORAGE_KEY);
          const isReturningUser = !!savedName;
          const homeRoute = isReturningUser ? 'main/Status' : '/';

          const results = await PenaltyRewardService.catchUpMissedDays();
          setReady(true);
          if (results.length > 0) {
            console.log('[startup] catch-up applied:', results);
            // replace (not push) so the summary screen isn't left
            // sitting under index in the back-stack
            router.replace({
              pathname: '/awaySummary',
              params: { results: JSON.stringify(results), homeRoute },
            });
          } else {
              setReady(true);
              router.replace(homeRoute);
          }
        } catch (e) {
          console.error('[startup] init failed', e);
          setReady(true);
          router.replace('/'); // safe fallback
        }
      })();
  }, []);

  if (!ready) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#8FF3E8" />
        </View>
      );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
