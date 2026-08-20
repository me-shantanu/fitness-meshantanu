// app/profile-setup.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '@/utils/alert';

interface FormData {
  height: string;
  weight: string;
  age: string;
  gender: 'male' | 'female';
  bmr: string;
  goal: 'lose_weight' | 'gain_muscle' | 'maintain';
}

export default function ProfileSetupScreen() {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    height: '',
    weight: '',
    age: '',
    gender: 'male',
    bmr: '',
    goal: 'maintain',
  });

  const goals = [
    { value: 'lose_weight' as const, label: 'Lose Weight', icon: '📉' },
    { value: 'gain_muscle' as const, label: 'Gain Muscle', icon: '💪' },
    { value: 'maintain' as const, label: 'Maintain', icon: '⚖️' },
  ];

  const handleSave = async () => {
    if (!formData.height || !formData.weight || !formData.age || !formData.bmr) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      height: parseFloat(formData.height),
      weight: parseFloat(formData.weight),
      age: parseInt(formData.age),
      gender: formData.gender,
      bmr: parseFloat(formData.bmr),
      goal: formData.goal,
    });
    setLoading(false);

    if (error) {
      showAlert('Error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg">
      <View className="px-6 pt-16 pb-8">
        <Text className="text-4xl font-bold text-text mb-2">Complete Your Profile</Text>
        <Text className="text-text-light mb-8">Help us personalize your experience</Text>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Height (cm)</Text>
          <TextInput
            className="bg-surface text-text px-4 py-3 rounded-lg"
            placeholder="175"
            placeholderTextColor="#6B7280"
            value={formData.height}
            onChangeText={(text) => setFormData({ ...formData, height: text })}
            keyboardType="numeric"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Weight (kg)</Text>
          <TextInput
            className="bg-surface text-text px-4 py-3 rounded-lg"
            placeholder="70"
            placeholderTextColor="#6B7280"
            value={formData.weight}
            onChangeText={(text) => setFormData({ ...formData, weight: text })}
            keyboardType="numeric"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Age</Text>
          <TextInput
            className="bg-surface text-text px-4 py-3 rounded-lg"
            placeholder="25"
            placeholderTextColor="#6B7280"
            value={formData.age}
            onChangeText={(text) => setFormData({ ...formData, age: text })}
            keyboardType="numeric"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Gender</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${formData.gender === 'male' ? 'bg-brand' : 'bg-surface'}`}
              onPress={() => setFormData({ ...formData, gender: 'male' })}
            >
              <Text className="text-text text-center font-bold">Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 rounded-lg ${formData.gender === 'female' ? 'bg-brand' : 'bg-surface'}`}
              onPress={() => setFormData({ ...formData, gender: 'female' })}
            >
              <Text className="text-text text-center font-bold">Female</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">BMR (Basal Metabolic Rate)</Text>
          <TextInput
            className="bg-surface text-text px-4 py-3 rounded-lg"
            placeholder="1800"
            placeholderTextColor="#6B7280"
            value={formData.bmr}
            onChangeText={(text) => setFormData({ ...formData, bmr: text })}
            keyboardType="numeric"
          />
          <Text className="text-text-light text-sm mt-1">Enter your known BMR or calculate it online</Text>
        </View>

        <View className="mb-6">
          <Text className="text-text mb-2 font-medium">Fitness Goal</Text>
          <View className="gap-3">
            {goals.map((goal) => (
              <TouchableOpacity
                key={goal.value}
                className={`py-3 px-4 rounded-lg flex-row items-center ${
                  formData.goal === goal.value ? 'bg-brand' : 'bg-surface'
                }`}
                onPress={() => setFormData({ ...formData, goal: goal.value })}
              >
                <Text className="text-2xl mr-3">{goal.icon}</Text>
                <Text className="text-text font-bold">{goal.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className="bg-brand py-4 rounded-lg"
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}