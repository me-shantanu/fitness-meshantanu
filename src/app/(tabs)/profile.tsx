import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { nutritionService } from '../../services/nutritionService';
import { Feather } from '@expo/vector-icons';
import {
  Sun,
  Moon,
  MonitorSmartphone,
  Ruler,
  Weight,
  Cake,
  User,
  Activity,
  Flame,
  Target,
} from 'lucide-react-native';
import { showAlert } from '@/utils/alert';
import { useThemeStore, ThemePreference } from '@/store/useThemeStore';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: MonitorSmartphone },
];

export default function ProfileScreen() {
  const { profile, signOut, updateProfile } = useAuthStore();
  const { preference, setPreference, colors } = useThemeStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const buildFormData = () => ({
    full_name: profile?.full_name || '',
    height: profile?.height?.toString() || '',
    weight: profile?.weight?.toString() || '',
    age: profile?.age?.toString() || '',
    gender: (profile?.gender || 'male') as string,
    activity_level: profile?.activity_level || 'moderate',
    goal: profile?.goal as string || 'maintain',
  });

  const [formData, setFormData] = useState(buildFormData);

  // Keep the form in sync when the profile refreshes (e.g. after logging
  // body weight elsewhere) — but never clobber in-progress edits.
  useEffect(() => {
    if (!isEditing) {
      setFormData(buildFormData());
    }
  }, [profile]);

  const goals = [
    { value: 'lose_weight', label: 'Lose Weight', icon: '📉' },
    { value: 'gain_muscle', label: 'Gain Muscle', icon: '💪' },
    { value: 'maintain', label: 'Maintain', icon: '⚖️' },
  ];

  // Live BMR from the current form values; null until all inputs are valid.
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
    if (!formData.full_name) {
      showAlert('Error', 'Name is required');
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

    const weightChanged = weight !== profile?.weight;

    setLoading(true);
    const { error } = await updateProfile({
      full_name: formData.full_name,
      height,
      weight,
      age,
      gender: formData.gender as 'male' | 'female' | 'other',
      bmr: Math.round(bmr),
      activity_level: formData.activity_level,
      goal: formData.goal as 'lose_weight' | 'gain_muscle' | 'maintain',
    });

    if (!error && weightChanged) {
      // Record the new weight in the body-weight history; ignore failures.
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
      showAlert('Success', 'Profile updated successfully');
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData(buildFormData());
    setIsEditing(false);
  };

  const InfoCard = ({ Icon, label, value }: { Icon: typeof Sun; label: string; value: string }) => (
    <View className="bg-surface rounded-2xl border border-border p-4 mb-3">
      <View className="flex-row items-center">
        <Icon size={22} color={colors.textLight} />
        <View className="flex-1 ml-3">
          <Text className="text-text-light text-xs mb-1">{label}</Text>
          <Text className="text-text text-base font-semibold">{value || 'Not set'}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-3xl font-bold">Profile</Text>
            {!isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                className="bg-brand rounded-full p-2"
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Feather name="edit-2" size={20} color={colors.onBrand} />
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Picture Placeholder */}
          <View className="items-center mb-6">
            <View className="w-24 h-24 rounded-full bg-brand items-center justify-center mb-3">
              <Text className="text-on-brand text-4xl font-bold">
                {profile?.full_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text className="text-text text-xl font-bold">{profile?.full_name || 'User'}</Text>
            <Text className="text-text-light text-sm">{profile?.email}</Text>
          </View>
        </View>

        {isEditing ? (
          // Edit Mode
          <View className="px-6 pb-6">
            <Text className="text-text text-lg font-bold mb-3">Edit Profile</Text>

            <View className="mb-4">
              <Text className="text-text mb-2 font-medium">Full Name</Text>
              <TextInput
                className="bg-surface-2 border border-border text-text px-4 py-3 rounded-xl"
                placeholder="John Doe"
                placeholderTextColor={colors.textLight}
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                accessibilityLabel="Full Name"
              />
            </View>

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

            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                className="flex-1 bg-surface-2 border border-border py-4 rounded-lg"
                onPress={handleCancel}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text className="text-text text-center font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary py-4 rounded-lg"
                onPress={handleSave}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text className="text-on-brand text-center font-bold">Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // View Mode
          <View className="px-6 pb-6">
            <Text className="text-text text-lg font-bold mb-3">Personal Information</Text>

            <InfoCard Icon={Ruler} label="Height" value={profile?.height ? `${profile.height} cm` : ''} />
            <InfoCard Icon={Weight} label="Weight" value={profile?.weight ? `${profile.weight} kg` : ''} />
            <InfoCard Icon={Cake} label="Age" value={profile?.age ? `${profile.age} years` : ''} />
            <InfoCard
              Icon={User}
              label="Gender"
              value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : ''}
            />
            <InfoCard
              Icon={Activity}
              label="Activity Level"
              value={ACTIVITY_LEVELS.find(l => l.value === profile?.activity_level)?.label || ''}
            />
            <InfoCard Icon={Flame} label="BMR" value={profile?.bmr ? `${profile.bmr} kcal/day` : ''} />
            <InfoCard
              Icon={Target}
              label="Fitness Goal"
              value={goals.find(g => g.value === profile?.goal)?.label || ''}
            />

            {/* Appearance */}
            <Text className="text-text text-lg font-bold mb-3 mt-6">Appearance</Text>
            <View className="bg-surface rounded-2xl border border-border p-4">
              <View className="flex-row gap-3">
                {THEME_OPTIONS.map(({ value, label, Icon }) => {
                  const selected = preference === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      className={`flex-1 py-3 rounded-xl items-center ${
                        selected ? 'bg-primary' : 'bg-surface-2 border border-border'
                      }`}
                      onPress={() => setPreference(value)}
                      accessibilityRole="button"
                      accessibilityLabel={`${label} theme`}
                      accessibilityState={{ selected }}
                    >
                      <Icon size={20} color={selected ? colors.onBrand : colors.textLight} />
                      <Text
                        className={`mt-1 text-sm font-bold ${
                          selected ? 'text-on-brand' : 'text-text-light'
                        }`}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              className="bg-danger py-4 rounded-lg mt-6"
              onPress={signOut}
              accessibilityRole="button"
            >
              <Text className="text-on-brand text-center font-bold text-base">Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
