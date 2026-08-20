// app/profile-setup.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { nutritionService } from '../services/nutritionService';
import { showAlert } from '@/utils/alert';
import { useThemeStore } from '@/store/useThemeStore';

interface FormData {
  height: string;
  weight: string;
  age: string;
  gender: 'male' | 'female' | 'other';
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose_weight' | 'gain_muscle' | 'maintain';
}

const GENDERS = [
  { value: 'male' as const, label: 'Male' },
  { value: 'female' as const, label: 'Female' },
  { value: 'other' as const, label: 'Other' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary' as const, label: 'Sedentary' },
  { value: 'light' as const, label: 'Light' },
  { value: 'moderate' as const, label: 'Moderate' },
  { value: 'active' as const, label: 'Active' },
  { value: 'very_active' as const, label: 'Very Active' },
];

export default function ProfileSetupScreen() {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const { colors } = useThemeStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    height: '',
    weight: '',
    age: '',
    gender: 'male',
    activity_level: 'moderate',
    goal: 'maintain',
  });

  const goals = [
    { value: 'lose_weight' as const, label: 'Lose Weight', icon: '📉' },
    { value: 'gain_muscle' as const, label: 'Gain Muscle', icon: '💪' },
    { value: 'maintain' as const, label: 'Maintain', icon: '⚖️' },
  ];

  // Live BMR: null until all inputs are valid.
  const computeBMR = (): number | null => {
    const height = parseFloat(formData.height);
    const weight = parseFloat(formData.weight);
    const age = parseInt(formData.age, 10);
    if (isNaN(height) || isNaN(weight) || isNaN(age)) return null;
    try {
      return nutritionService.calculateBMR(weight, height, age, formData.gender);
    } catch {
      return null;
    }
  };
  const computedBMR = computeBMR();

  const handleSave = async () => {
    if (!formData.height || !formData.weight || !formData.age) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    const height = parseFloat(formData.height);
    const weight = parseFloat(formData.weight);
    const age = parseInt(formData.age, 10);

    if (isNaN(height) || height < 50 || height > 300) {
      showAlert('Error', 'Please enter a valid height between 50 and 300 cm');
      return;
    }
    if (isNaN(weight) || weight < 20 || weight > 500) {
      showAlert('Error', 'Please enter a valid weight between 20 and 500 kg');
      return;
    }
    if (isNaN(age) || age < 5 || age > 120) {
      showAlert('Error', 'Please enter a valid age between 5 and 120');
      return;
    }

    let bmr: number;
    try {
      bmr = nutritionService.calculateBMR(weight, height, age, formData.gender);
    } catch {
      showAlert('Error', 'Could not calculate BMR from the provided values');
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      height,
      weight,
      age,
      gender: formData.gender,
      bmr: Math.round(bmr),
      activity_level: formData.activity_level,
      goal: formData.goal,
    });

    if (!error) {
      // Seed the body-weight history with the first entry; ignore failures.
      try {
        await supabase.rpc('log_body_weight', { p_weight: weight });
      } catch {
        // ignore
      }
    }
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
            className="bg-surface-2 border border-border text-text px-4 py-3 rounded-xl"
            placeholder="175"
            placeholderTextColor={colors.textLight}
            value={formData.height}
            onChangeText={(text) => setFormData({ ...formData, height: text })}
            keyboardType="numeric"
            accessibilityLabel="Height (cm)"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Weight (kg)</Text>
          <TextInput
            className="bg-surface-2 border border-border text-text px-4 py-3 rounded-xl"
            placeholder="70"
            placeholderTextColor={colors.textLight}
            value={formData.weight}
            onChangeText={(text) => setFormData({ ...formData, weight: text })}
            keyboardType="numeric"
            accessibilityLabel="Weight (kg)"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Age</Text>
          <TextInput
            className="bg-surface-2 border border-border text-text px-4 py-3 rounded-xl"
            placeholder="25"
            placeholderTextColor={colors.textLight}
            value={formData.age}
            onChangeText={(text) => setFormData({ ...formData, age: text })}
            keyboardType="numeric"
            accessibilityLabel="Age"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Gender</Text>
          <View className="flex-row gap-3">
            {GENDERS.map((gender) => (
              <TouchableOpacity
                key={gender.value}
                className={`flex-1 py-3 rounded-lg ${formData.gender === gender.value ? 'bg-primary' : 'bg-surface-2 border border-border'}`}
                onPress={() => setFormData({ ...formData, gender: gender.value })}
                accessibilityRole="button"
                accessibilityState={{ selected: formData.gender === gender.value }}
              >
                <Text className={`text-center font-bold ${formData.gender === gender.value ? 'text-on-brand' : 'text-text-light'}`}>{gender.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Activity Level</Text>
          <View className="flex-row flex-wrap gap-2">
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                className={`px-4 py-2 rounded-full ${formData.activity_level === level.value ? 'bg-primary' : 'bg-surface-2 border border-border'}`}
                onPress={() => setFormData({ ...formData, activity_level: level.value })}
                accessibilityRole="button"
                accessibilityState={{ selected: formData.activity_level === level.value }}
              >
                <Text className={`font-bold ${formData.activity_level === level.value ? 'text-on-brand' : 'text-text-light'}`}>{level.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {computedBMR !== null && (
          <View className="mb-4 bg-surface rounded-2xl border border-border p-4">
            <Text className="text-text font-bold text-lg">
              Estimated BMR: {computedBMR} kcal
            </Text>
            <Text className="text-text-light text-sm mt-1">Calculated automatically</Text>
          </View>
        )}

        <View className="mb-6">
          <Text className="text-text mb-2 font-medium">Fitness Goal</Text>
          <View className="gap-3">
            {goals.map((goal) => (
              <TouchableOpacity
                key={goal.value}
                className={`py-3 px-4 rounded-lg flex-row items-center ${
                  formData.goal === goal.value ? 'bg-primary' : 'bg-surface-2 border border-border'
                }`}
                onPress={() => setFormData({ ...formData, goal: goal.value })}
                accessibilityRole="button"
                accessibilityState={{ selected: formData.goal === goal.value }}
              >
                <Text className="text-2xl mr-3">{goal.icon}</Text>
                <Text className={`font-bold ${formData.goal === goal.value ? 'text-on-brand' : 'text-text-light'}`}>{goal.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className="bg-primary py-4 rounded-lg"
          onPress={handleSave}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text className="text-on-brand text-center font-bold text-lg">Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
