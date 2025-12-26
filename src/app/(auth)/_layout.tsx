import { useThemeStore } from "@/store/useThemeStore";
import { Stack } from "expo-router";
import { View } from "react-native";

export default function AuthLayout() {
  const { vars, mode } = useThemeStore();

  return (
    <View
      key={mode}          // 🔥 forces NativeWind refresh
      style={vars}
      className="flex-1 bg-bg"
    >
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
