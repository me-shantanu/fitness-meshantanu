// app/_layout.tsx
import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { View, ActivityIndicator, Platform } from "react-native";

export default function RootLayout() {
  const { user, profile, loading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Skip initialization on server-side
    if (typeof window === 'undefined') return;
    
    initialize().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady || loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inProfileSetup = segments[0] === "profile-setup";

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/(auth)/login");
    } else if (user && !profile?.height && !inProfileSetup) {
      // Redirect to profile setup if profile incomplete
      router.replace("/profile-setup");
    } else if (user && profile?.height && (inAuthGroup || inProfileSetup)) {
      // Redirect to main app if authenticated and profile complete
      router.replace("/(tabs)");
    }
  }, [user, profile, segments, loading, isReady]);

  // Show loading only for native platforms
  if (!isReady || loading) {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return null; // Don't render anything during SSR
    }
    
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return <Slot />;
}