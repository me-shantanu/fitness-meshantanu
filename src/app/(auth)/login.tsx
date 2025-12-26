// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    }
  };

  return (
    <View className="flex-1 bg-gray-900 px-6 justify-center">
      <Text className="text-4xl font-bold text-white mb-2">Welcome Back</Text>
      <Text className="text-gray-400 mb-8">Sign in to continue your fitness journey</Text>

      <View className="mb-4">
        <Text className="text-white mb-2 font-medium">Email</Text>
        <TextInput
          className="bg-gray-800 text-white px-4 py-3 rounded-lg"
          placeholder="your@email.com"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View className="mb-6">
        <Text className="text-white mb-2 font-medium">Password</Text>
        <TextInput
          className="bg-gray-800 text-white px-4 py-3 rounded-lg"
          placeholder="••••••••"
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        className="bg-blue-600 py-4 rounded-lg mb-4"
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold text-lg">Sign In</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center">
        <Text className="text-gray-400">Don't have an account? </Text>
        <Link href="/(auth)/signup">
          <Text className="text-blue-500 font-bold">Sign Up</Text>
        </Link>
      </View>
    </View>
  );
}