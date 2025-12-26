import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  
  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <View className="flex-1 justify-center items-center px-6">
        <Text className="text-white text-2xl mb-4">Profile</Text>
        <Text className="text-gray-400">Name: {profile?.full_name}</Text>
        <Text className="text-gray-400">Email: {profile?.email}</Text>
        
        <TouchableOpacity
          className="bg-red-600 px-6 py-3 rounded-lg mt-8"
          onPress={signOut}
        >
          <Text className="text-white font-bold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}