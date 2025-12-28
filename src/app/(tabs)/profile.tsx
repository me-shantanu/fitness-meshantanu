import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Pressable } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '@/store/useThemeStore';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  // const toggleTheme = useThemeStore((s) => s?.toggleTheme);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 justify-center items-center px-6">
        <Text className="text-text text-2xl mb-4">Profile</Text>
        <Text className="text-text-light">Name: {profile?.full_name}</Text>
        <Text className="text-text-light">Email: {profile?.email}</Text>
        {/* <Pressable
          onPress={toggleTheme}
          className="mt-4 rounded-xl bg-surface p-4 active:bg-surface"
        >
          <Text className="text-text text-center">
            Toggle Theme
          </Text>
        </Pressable> */}
        <TouchableOpacity
          className="bg-red-600 px-6 py-3 rounded-lg mt-8"
          onPress={signOut}
        >
          <Text className="text-text font-bold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}