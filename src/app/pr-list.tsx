// app/pr-list.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import { useThemeStore } from '@/store/useThemeStore';

interface PersonalRecord {
  id: string;
  exercise_name: string;
  max_weight: number;
  max_reps: number;
  achieved_at: string;
  session_id: string | null;
}

export default function PRListScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { user } = useAuthStore();

  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [user?.id]);

  const loadRecords = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading personal records:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <AntDesign name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-text text-2xl font-bold ml-4">Personal Records</Text>
        </View>

        <View className="px-4 pt-4 pb-8">
          {records.length > 0 ? (
            records.map((pr) => {
              const tappable = !!pr.session_id;
              return (
                <TouchableOpacity
                  key={pr.id}
                  className="bg-surface rounded-2xl border border-border p-4 mb-3"
                  disabled={!tappable}
                  onPress={() => {
                    if (!pr.session_id) return;
                    router.push({
                      pathname: '/workout-details',
                      params: { sessionId: pr.session_id }
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View workout for ${pr.exercise_name} personal record`}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-text font-bold text-lg flex-1">
                      {pr.exercise_name}
                    </Text>
                    <View className="bg-accent/15 px-3 py-1 rounded-full">
                      <Text className="text-accent font-bold">PR 🏆</Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-text-light text-sm">Best Set</Text>
                      <Text className="text-text font-bold text-xl">
                        {pr.max_weight}kg × {pr.max_reps}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="text-text-light text-sm">Achieved</Text>
                      <Text className="text-text">{formatDate(pr.achieved_at)}</Text>
                    </View>

                    {tappable && (
                      <Feather name="chevron-right" size={20} color={colors.textLight} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View className="bg-surface rounded-2xl border border-border p-8 items-center mt-4">
              <Feather name="award" size={48} color={colors.textLight} />
              <Text className="text-text text-lg font-bold mt-4 mb-2">
                No Personal Records Yet
              </Text>
              <Text className="text-text-light text-center">
                Complete workouts and set new personal records to see them here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
