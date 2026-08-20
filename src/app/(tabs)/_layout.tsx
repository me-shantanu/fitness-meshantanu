import { Tabs } from "expo-router";
import { useThemeStore } from "@/store/useThemeStore";
import { View } from "react-native";
import Icon from "@/components/Icon";

export default function TabsLayout() {
  const { vars, colors } = useThemeStore();

  return (
    <View

      style={vars}
      className="flex-1 bg-bg"
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.textLight,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Icon name="House" color={color} size={size} />
              // <AntDesign name="home" color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="exercises"
          options={{
            title: "Exercises",
            tabBarIcon: ({ color, size }) => (
              <Icon name="ClipboardList" color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="workout"
          options={{
            title: "Workout",
            tabBarIcon: ({ color, size }) => (
              <Icon name="Dumbbell" color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="coach"
          options={{
            title: "Coach",
            tabBarIcon: ({ color, size }) => (
              <Icon name="Bot" color={color} size={size} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Icon name="UserCircle" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
