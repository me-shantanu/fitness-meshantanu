import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { View, ActivityIndicator } from "react-native";
import { useThemeStore } from "@/store/useThemeStore";
import { useFonts } from 'expo-font';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar, Platform, Appearance } from 'react-native';

export default function RootLayout() {
  const { user, profile, loading, initialize } = useAuthStore();
  const { vars, mode, colors, syncWithSystem } = useThemeStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  const [loaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    initialize().then(() => setIsReady(true));
  }, []);

  // Follow OS light/dark changes while the preference is "system".
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => syncWithSystem());
    return () => sub.remove();
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
    <SafeAreaProvider>
      <StatusBar
        barStyle={mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <View style={vars} className="flex-1 bg-bg">
        {(!isReady || loading || !loaded) ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <SafeAreaView
            edges={['top', 'left', 'right']}
            className="flex-1"
            style={{
              paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
            }}
          ><Slot /></SafeAreaView>

        )}
      </View>
    </SafeAreaProvider>
  );
}
