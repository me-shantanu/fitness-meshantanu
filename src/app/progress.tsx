import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('volume'); // volume, workouts, calories, prs
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, 3months, year
  const [progressData, setProgressData] = useState([]);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalVolume: 0,
    totalCalories: 0,
    currentStreak: 0,
    bestStreak: 0,
    workoutDaysThisMonth: 0
  });

  useEffect(() => {
    loadProgressData();
  }, [selectedPeriod]);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (selectedPeriod) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(now.getMonth() - 1);
      }

      // Load workout sessions
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          exercise_sets (
            weight,
            reps,
            exercise_name
          )
        `)
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .not('completed_at', 'is', null)
        .order('date', { ascending: true });

      if (error) throw error;

      // Load personal records
      const { data: prs } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false });

      setPersonalRecords(prs || []);

      // Process data for visualization
      const processedData = processProgressData(sessions || []);
      setProgressData(processedData);

      // Calculate stats
      calculateStats(sessions || []);
    } catch (error) {
      console.error('Error loading progress data:', error);
    }
    setLoading(false);
  };

  const processProgressData = (sessions) => {
    // Group sessions by week for display
    const weeklyData = {};
    
    sessions.forEach(session => {
      const date = new Date(session.date);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          weekStart,
          volume: 0,
          calories: 0,
          workouts: 0,
          sets: 0
        };
      }
      
      // Calculate session volume
      const sessionVolume = session.exercise_sets?.reduce((sum, set) => 
        sum + (set.weight * set.reps), 0) || 0;
      
      weeklyData[weekKey].volume += sessionVolume;
      weeklyData[weekKey].calories += session.total_calories_burned || 0;
      weeklyData[weekKey].workouts += 1;
      weeklyData[weekKey].sets += session.exercise_sets?.length || 0;
    });

    // Convert to array and sort by date
    return Object.values(weeklyData)
      .sort((a, b) => a.weekStart - b.weekStart)
      .map((week, index) => ({
        ...week,
        label: `Week ${index + 1}`,
        shortLabel: `W${index + 1}`
      }));
  };

  const getWeekStart = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(date.setDate(diff));
  };

  const calculateStats = (sessions) => {
    let totalWorkouts = sessions.length;
    let totalVolume = 0;
    let totalCalories = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let currentStreakCount = 0;
    const workoutDays = new Set();

    // Sort sessions by date
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    // Calculate streaks and totals
    let prevDate = null;
    sortedSessions.forEach(session => {
      // Calculate volume and calories
      const sessionVolume = session.exercise_sets?.reduce((sum, set) => 
        sum + (set.weight * set.reps), 0) || 0;
      totalVolume += sessionVolume;
      totalCalories += session.total_calories_burned || 0;
      
      // Track unique workout days
      workoutDays.add(session.date);
      
      // Calculate streak
      const currentDate = new Date(session.date);
      if (prevDate) {
        const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreakCount++;
          bestStreak = Math.max(bestStreak, currentStreakCount);
        } else if (diffDays > 1) {
          currentStreakCount = 1;
        }
      } else {
        currentStreakCount = 1;
      }
      prevDate = currentDate;
    });

    currentStreak = currentStreakCount;
    
    // Calculate workout days this month
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const workoutDaysThisMonth = Array.from(workoutDays).filter(dateStr => {
      const date = new Date(dateStr);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    setStats({
      totalWorkouts,
      totalVolume,
      totalCalories,
      currentStreak,
      bestStreak,
      workoutDaysThisMonth
    });
  };

  const renderProgressBars = () => {
    if (progressData.length === 0) {
      return (
        <View className="bg-gray-800 rounded-xl p-8 items-center">
          <Feather name="trending-up" size={48} color="#6B7280" />
          <Text className="text-white text-lg font-bold mt-4 mb-2">
            No Data Available
          </Text>
          <Text className="text-gray-400 text-center">
            Complete workouts to see your progress
          </Text>
        </View>
      );
    }

    // Get max value for scaling
    const maxValue = Math.max(...progressData.map(item => item[selectedMetric]));
    
    return (
      <View className="bg-gray-800 rounded-xl p-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-white font-bold">
            {selectedMetric === 'volume' && 'Training Volume (kg)'}
            {selectedMetric === 'workouts' && 'Workouts per Week'}
            {selectedMetric === 'calories' && 'Calories Burned'}
            {selectedMetric === 'sets' && 'Sets per Week'}
          </Text>
          <Text className="text-gray-400">
            {progressData.length} weeks
          </Text>
        </View>
        
        <View className="h-40 flex-row items-end justify-between">
          {progressData.slice(-8).map((week, index) => {
            const value = week[selectedMetric];
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            
            let barColor = '#3B82F6'; // Blue for volume
            if (selectedMetric === 'workouts') barColor = '#10B981'; // Green
            if (selectedMetric === 'calories') barColor = '#EF4444'; // Red
            if (selectedMetric === 'sets') barColor = '#8B5CF6'; // Purple
            
            return (
              <View key={index} className="items-center flex-1">
                <View 
                  className="w-6 rounded-t-lg"
                  style={{
                    height: `${percentage}%`,
                    backgroundColor: barColor,
                    minHeight: 4
                  }}
                />
                <Text className="text-gray-400 text-xs mt-2">{week.shortLabel}</Text>
                <Text className="text-white text-xs font-bold mt-1">
                  {selectedMetric === 'volume' ? Math.round(value) : Math.round(value)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderProgressCards = () => (
    <View className="px-4 mb-6">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row">
          <View className="bg-blue-600/20 rounded-xl p-4 mr-3 w-40">
            <View className="flex-row items-center mb-2">
              <Feather name="activity" size={20} color="#3B82F6" />
              <Text className="text-white font-bold ml-2">Workout Streak</Text>
            </View>
            <Text className="text-white text-2xl font-bold">{stats.currentStreak} days</Text>
            <Text className="text-blue-300 text-sm">Best: {stats.bestStreak} days</Text>
          </View>
          
          <View className="bg-green-600/20 rounded-xl p-4 mr-3 w-40">
            <View className="flex-row items-center mb-2">
              <Feather name="calendar" size={20} color="#10B981" />
              <Text className="text-white font-bold ml-2">This Month</Text>
            </View>
            <Text className="text-white text-2xl font-bold">{stats.workoutDaysThisMonth} days</Text>
            <Text className="text-green-300 text-sm">Workout days</Text>
          </View>
          
          <View className="bg-purple-600/20 rounded-xl p-4 w-40">
            <View className="flex-row items-center mb-2">
              <Feather name="award" size={20} color="#8B5CF6" />
              <Text className="text-white font-bold ml-2">Personal Records</Text>
            </View>
            <Text className="text-white text-2xl font-bold">{personalRecords.length}</Text>
            <Text className="text-purple-300 text-sm">Achievements</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderPersonalRecords = () => (
    <View className="px-4 mb-8">
      <Text className="text-white text-xl font-bold mb-4">Personal Records</Text>
      
      {personalRecords.length > 0 ? (
        personalRecords.slice(0, 5).map((pr, index) => (
          <TouchableOpacity
            key={pr.id}
            className="bg-gray-800 rounded-xl p-4 mb-3"
            onPress={() => router.push({
              pathname: '/workout-details',
              params: { sessionId: pr.session_id }
            })}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-white font-bold text-lg">{pr.exercise_name}</Text>
              <View className="bg-yellow-500/20 px-3 py-1 rounded-full">
                <Text className="text-yellow-400 font-bold">PR 🏆</Text>
              </View>
            </View>
            
            <View className="flex-row justify-between">
              <View>
                <Text className="text-gray-400 text-sm">Max Weight</Text>
                <Text className="text-white font-bold text-xl">{pr.max_weight}kg</Text>
              </View>
              
              <View>
                <Text className="text-gray-400 text-sm">Max Reps</Text>
                <Text className="text-white font-bold text-xl">{pr.max_reps}</Text>
              </View>
              
              <View>
                <Text className="text-gray-400 text-sm">Date</Text>
                <Text className="text-white">
                  {new Date(pr.achieved_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View className="bg-gray-800 rounded-xl p-6 items-center">
          <Feather name="award" size={48} color="#6B7280" />
          <Text className="text-white text-lg font-bold mt-4 mb-2">
            No Personal Records Yet
          </Text>
          <Text className="text-gray-400 text-center mb-4">
            Set new personal records in your workouts!
          </Text>
        </View>
      )}
      
      {personalRecords.length > 5 && (
        <TouchableOpacity
          className="bg-gray-800 rounded-xl p-4 items-center mt-3"
          onPress={() => {
            // You can create a PR list screen later
            Alert.alert('Coming Soon', 'Full PR list view coming soon!');
          }}
        >
          <Text className="text-blue-400 font-bold">
            View All {personalRecords.length} Records →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-white text-3xl font-bold mb-4">Progress</Text>
          
          {/* Metric Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {[
              { id: 'volume', label: 'Volume', icon: 'bar-chart-2' },
              { id: 'workouts', label: 'Workouts', icon: 'activity' },
              { id: 'calories', label: 'Calories', icon: 'fire' },
              { id: 'sets', label: 'Sets', icon: 'list' }
            ].map((metric) => (
              <TouchableOpacity
                key={metric.id}
                className={`flex-row items-center px-4 py-2 rounded-full mr-2 ${
                  selectedMetric === metric.id ? 'bg-blue-600' : 'bg-gray-800'
                }`}
                onPress={() => setSelectedMetric(metric.id)}
              >
                <Feather name={metric.icon} size={16} color="white" />
                <Text className="text-white font-medium ml-2">{metric.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Period Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {[
              { id: 'week', label: '1 Week' },
              { id: 'month', label: '1 Month' },
              { id: '3months', label: '3 Months' },
              { id: 'year', label: '1 Year' }
            ].map((period) => (
              <TouchableOpacity
                key={period.id}
                className={`px-4 py-2 rounded-full mr-2 ${
                  selectedPeriod === period.id ? 'bg-green-600' : 'bg-gray-800'
                }`}
                onPress={() => setSelectedPeriod(period.id)}
              >
                <Text className="text-white font-medium">{period.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Progress Cards */}
        {renderProgressCards()}

        {/* Progress Visualization */}
        <View className="px-4 mb-6">
          <Text className="text-white text-xl font-bold mb-4">
            {selectedMetric === 'volume' && 'Training Volume Progress'}
            {selectedMetric === 'workouts' && 'Workout Frequency'}
            {selectedMetric === 'calories' && 'Calories Burned'}
            {selectedMetric === 'sets' && 'Sets Completed'}
          </Text>
          
          {renderProgressBars()}
        </View>

        {/* Stats Summary */}
        <View className="px-4 mb-6">
          <Text className="text-white text-xl font-bold mb-4">Statistics</Text>
          
          <View className="bg-gray-800 rounded-xl p-4">
            <View className="flex-row justify-between mb-4">
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-bold">{stats.totalWorkouts}</Text>
                <Text className="text-gray-400">Total Workouts</Text>
              </View>
              
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-bold">{stats.totalCalories}</Text>
                <Text className="text-gray-400">Calories Burned</Text>
              </View>
              
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-bold">{Math.round(stats.totalVolume)}</Text>
                <Text className="text-gray-400">Total Volume (kg)</Text>
              </View>
            </View>
            
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Feather name="trending-up" size={20} color="#10B981" />
                <Text className="text-white font-bold mt-1">{stats.currentStreak}</Text>
                <Text className="text-gray-400 text-xs">Current Streak</Text>
              </View>
              
              <View className="items-center flex-1">
                <Feather name="target" size={20} color="#3B82F6" />
                <Text className="text-white font-bold mt-1">{stats.bestStreak}</Text>
                <Text className="text-gray-400 text-xs">Best Streak</Text>
              </View>
              
              <View className="items-center flex-1">
                <Feather name="calendar" size={20} color="#8B5CF6" />
                <Text className="text-white font-bold mt-1">{stats.workoutDaysThisMonth}</Text>
                <Text className="text-gray-400 text-xs">Days This Month</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Personal Records */}
        {renderPersonalRecords()}
      </ScrollView>
    </SafeAreaView>
  );
}