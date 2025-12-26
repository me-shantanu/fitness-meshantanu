import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { workoutService } from '../services/workoutService';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // week, month, year
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, completed, active

  useEffect(() => {
    loadWorkoutHistory();
  }, [selectedPeriod, selectedFilter]);

  const loadWorkoutHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('workout_sessions')
        .select(`
          *,
          workout_days (
            name,
            is_rest_day
          ),
          exercise_sets (
            id,
            exercise_name,
            weight,
            reps
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      // Apply date filter
      const now = new Date();
      let startDate = new Date();
      
      switch (selectedPeriod) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      query = query.gte('date', startDate.toISOString().split('T')[0]);

      // Apply status filter
      if (selectedFilter === 'completed') {
        query = query.not('completed_at', 'is', null);
      } else if (selectedFilter === 'active') {
        query = query.is('completed_at', null);
      }

      const { data: sessions, error } = await query;

      if (error) throw error;

      // Group by date
      const groupedSessions = sessions.reduce((groups, session) => {
        const date = session.date;
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(session);
        return groups;
      }, {});

      // Format for SectionList
      const sections = Object.keys(groupedSessions).map(date => ({
        title: date,
        data: groupedSessions[date]
      }));

      setWorkoutHistory(sections);
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
    setLoading(false);
  };

  const getTotalStats = () => {
    let totalWorkouts = 0;
    let totalCalories = 0;
    let totalSets = 0;

    workoutHistory.forEach(section => {
      section.data.forEach(session => {
        totalWorkouts++;
        totalCalories += session.total_calories_burned || 0;
        totalSets += session.exercise_sets?.length || 0;
      });
    });

    return { totalWorkouts, totalCalories, totalSets };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  const renderWorkoutSession = ({ item: session }) => {
    const duration = session.completed_at 
      ? Math.round((new Date(session.completed_at) - new Date(session.started_at)) / 60000)
      : null;
    
    const totalVolume = session.exercise_sets?.reduce((sum, set) => 
      sum + (set.weight * set.reps), 0) || 0;

    return (
      <TouchableOpacity
        className="bg-surface rounded-xl p-4 mb-3 mx-4"
        onPress={() => router.push({
          pathname: '/workout-details',
          params: { sessionId: session.id }
        })}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-text font-bold text-lg mb-1">
              {session.workout_days?.name || 'Quick Workout'}
            </Text>
            <Text className="text-text-light text-sm">
              {session.completed_at ? 'Completed' : 'In Progress'}
            </Text>
          </View>
          
          <View className="items-end">
            <Text className="text-text font-bold">
              {session.start_time ? new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </Text>
            {duration && (
              <Text className="text-text-light text-sm">{duration} min</Text>
            )}
          </View>
        </View>
        
        <View className="flex-row justify-between mb-3">
          <View className="items-center flex-1">
            <Feather name="activity" size={20} color="#10B981" />
            <Text className="text-text font-bold mt-1">{session.exercise_sets?.length || 0}</Text>
            <Text className="text-text-light text-xs">Sets</Text>
          </View>
          
          <View className="items-center flex-1">
            <Feather name="bar-chart-2" size={20} color="#3B82F6" />
            <Text className="text-text font-bold mt-1">{Math.round(totalVolume)}</Text>
            <Text className="text-text-light text-xs">Volume</Text>
          </View>
          
          <View className="items-center flex-1">
            <Feather name="fire" size={20} color="#EF4444" />
            <Text className="text-text font-bold mt-1">{session.total_calories_burned || 0}</Text>
            <Text className="text-text-light text-xs">Calories</Text>
          </View>
        </View>
        
        {session.exercise_sets && session.exercise_sets.length > 0 && (
          <View className="mt-3 pt-3 border-t border-gray-700">
            <Text className="text-text-light text-sm mb-2">Exercises:</Text>
            <View className="flex-row flex-wrap">
              {[...new Set(session.exercise_sets.map(s => s.exercise_name))].slice(0, 3).map((name, index) => (
                <View key={index} className="bg-gray-700 px-2 py-1 rounded mr-1 mb-1">
                  <Text className="text-gray-300 text-xs">{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View className="px-4 py-3 bg-bg">
      <Text className="text-text font-bold text-lg">
        {formatDate(title)}
      </Text>
    </View>
  );

  const stats = getTotalStats();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-text text-3xl font-bold mb-4">Workout History</Text>
          
          {/* Period Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {[
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All Time' }
            ].map((period) => (
              <TouchableOpacity
                key={period.id}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selectedPeriod === period.id ? 'bg-blue-600' : 'bg-surface'
                }`}
                onPress={() => setSelectedPeriod(period.id)}
              >
                <Text className="text-text font-medium">{period.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Status Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {[
              { id: 'all', label: 'All Workouts' },
              { id: 'completed', label: 'Completed' },
              { id: 'active', label: 'Active' }
            ].map((filter) => (
              <TouchableOpacity
                key={filter.id}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selectedFilter === filter.id ? 'bg-green-600' : 'bg-surface'
                }`}
                onPress={() => setSelectedFilter(filter.id)}
              >
                <Text className="text-text font-medium">{filter.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats Summary */}
        <View className="px-4 mb-6">
          <Text className="text-text text-xl font-bold mb-4">Summary</Text>
          
          <View className="flex-row justify-between">
            <View className="bg-surface flex-1 mr-2 rounded-xl p-4 items-center">
              <MaterialIcons name="fitness-center" size={24} color="#3B82F6" />
              <Text className="text-text text-2xl font-bold mt-2">{stats.totalWorkouts}</Text>
              <Text className="text-text-light">Workouts</Text>
            </View>
            
            <View className="bg-surface flex-1 mx-2 rounded-xl p-4 items-center">
              <Feather name="fire" size={24} color="#EF4444" />
              <Text className="text-text text-2xl font-bold mt-2">{stats.totalCalories}</Text>
              <Text className="text-text-light">Calories</Text>
            </View>
            
            <View className="bg-surface flex-1 ml-2 rounded-xl p-4 items-center">
              <Feather name="activity" size={24} color="#10B981" />
              <Text className="text-text text-2xl font-bold mt-2">{stats.totalSets}</Text>
              <Text className="text-text-light">Sets</Text>
            </View>
          </View>
        </View>

        {/* Workout History List */}
        <View className="mb-8">
          {workoutHistory.length > 0 ? (
            <SectionList
              sections={workoutHistory}
              keyExtractor={(item) => item.id}
              renderItem={renderWorkoutSession}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              scrollEnabled={false}
            />
          ) : (
            <View className="px-4">
              <View className="bg-surface rounded-xl p-8 items-center">
                <Feather name="calendar" size={48} color="#6B7280" />
                <Text className="text-text text-lg font-bold mt-4 mb-2">
                  No Workouts Found
                </Text>
                <Text className="text-text-light text-center mb-4">
                  {selectedFilter === 'active' 
                    ? 'No active workouts in this period'
                    : 'No completed workouts in this period'}
                </Text>
                <TouchableOpacity
                  className="bg-blue-600 px-6 py-3 rounded-lg"
                  onPress={() => router.push('/workout')}
                >
                  <Text className="text-text font-bold">Start Workout</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}