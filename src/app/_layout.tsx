import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { View, ActivityIndicator, Platform } from "react-native";
import { useThemeStore } from "@/store/useThemeStore";

export default function RootLayout() {
  const { user, profile, loading, initialize } = useAuthStore();
  const { vars, mode } = useThemeStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    initialize().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady || loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inProfileSetup = segments[0] === "profile-setup";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && !profile?.height && !inProfileSetup) {
      router.replace("/profile-setup");
    } else if (user && profile?.height && (inAuthGroup || inProfileSetup)) {
      router.replace("/(tabs)");
    }
  }, [user, profile, segments, loading, isReady]);

  return (
    <View key={mode} style={vars} className="flex-1 bg-bg">
      {(!isReady || loading) ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="var(--text)" />
        </View>
      ) : (
        <Slot />
      )}
    </View>
  );
}
