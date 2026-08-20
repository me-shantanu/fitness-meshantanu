import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { showAlert } from '@/utils/alert';
import { localDateString } from '../utils/date';
import { useThemeStore } from '@/store/useThemeStore';

const { width: screenWidth } = Dimensions.get('window');

interface WeightEntry {
  date: string;
  weight: number;
}

export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { user, profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('volume'); // volume, workouts, calories, prs
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, 3months, year
  const [progressData, setProgressData] = useState([]);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
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
    if (!user?.id) {
      setLoading(false);
      return;
    }

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

      // Load body-weight history (latest 30 entries)
      const { data: weights } = await supabase
        .from('body_weight_log')
        .select('date, weight')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30);

      setWeightHistory((weights as WeightEntry[]) || []);

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
      .sort((a: any, b: any) => a.weekStart - b.weekStart)
      .map((week: any, index) => ({
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
      new Date(a.date).getTime() - new Date(b.date).getTime()
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
        const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
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
      const date = new Date(dateStr as string);
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
        <View className="bg-surface rounded-2xl border border-border p-8 items-center">
          <Feather name="trending-up" size={48} color={colors.textLight} />
          <Text className="text-text text-lg font-bold mt-4 mb-2">
            No Data Available
          </Text>
          <Text className="text-text-light text-center">
            Complete workouts to see your progress
          </Text>
        </View>
      );
    }

    // Get max value for scaling
    const maxValue = Math.max(...progressData.map(item => item[selectedMetric]));

    return (
      <View className="bg-surface rounded-2xl border border-border p-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-text font-bold">
            {selectedMetric === 'volume' && 'Training Volume (kg)'}
            {selectedMetric === 'workouts' && 'Workouts per Week'}
            {selectedMetric === 'calories' && 'Calories Burned'}
            {selectedMetric === 'sets' && 'Sets per Week'}
          </Text>
          <Text className="text-text-light">
            {progressData.length} weeks
          </Text>
        </View>

        <View className="h-40 flex-row items-end justify-between">
          {progressData.slice(-8).map((week, index) => {
            const value = week[selectedMetric];
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

            let barColor = colors.brand;
            if (selectedMetric === 'calories') barColor = colors.accent;

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
                <Text className="text-text-light text-xs mt-2">{week.shortLabel}</Text>
                <Text className="text-text text-xs font-bold mt-1">
                  {selectedMetric === 'volume' ? Math.round(value) : Math.round(value)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const handleWeightLogged = (entry: WeightEntry) => {
    setWeightHistory(prev => {
      const rest = prev.filter(e => e.date !== entry.date);
      return [entry, ...rest].sort((a, b) => (a.date < b.date ? 1 : -1));
    });
    setShowWeightModal(false);
  };

  const formatWeightDate = (dateString: string) =>
    new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

  const renderBodyWeightCard = () => {
    const currentWeight = weightHistory[0]?.weight ?? profile?.weight ?? null;
    const recentEntries = weightHistory.slice(0, 8);

    return (
      <View className="px-4 mb-6">
        <Text className="text-text text-lg font-bold mb-3">Body Weight</Text>

        <View className="bg-surface rounded-2xl border border-border p-4">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-text-light text-sm">Current Weight</Text>
              <Text className="text-text text-2xl font-bold">
                {currentWeight !== null ? `${currentWeight} kg` : 'Not set'}
              </Text>
            </View>

            <TouchableOpacity
              className="bg-primary px-4 py-2 rounded-lg"
              onPress={() => setShowWeightModal(true)}
            >
              <Text className="text-on-brand font-bold">Log Weight</Text>
            </TouchableOpacity>
          </View>

          {recentEntries.length > 0 && (
            <View className="mt-4 pt-3 border-t border-border">
              {recentEntries.map((entry, index) => {
                const previous = recentEntries[index + 1];
                const delta = previous ? entry.weight - previous.weight : null;

                return (
                  <View
                    key={entry.date}
                    className="flex-row justify-between items-center py-2"
                  >
                    <Text className="text-text-light">{formatWeightDate(entry.date)}</Text>
                    <View className="flex-row items-center">
                      {delta !== null && Math.abs(delta) >= 0.05 && (
                        <View className="flex-row items-center mr-3">
                          <Feather
                            name={delta > 0 ? 'arrow-up' : 'arrow-down'}
                            size={14}
                            color={delta > 0 ? colors.danger : colors.brand}
                          />
                          <Text
                            className={`text-xs ml-1 ${delta > 0 ? 'text-danger' : 'text-primary'}`}
                          >
                            {Math.abs(delta).toFixed(1)}
                          </Text>
                        </View>
                      )}
                      <Text className="text-text font-bold">{entry.weight} kg</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {recentEntries.length === 0 && (
            <Text className="text-text-light text-sm mt-3">
              Log your weight to start tracking your trend.
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderProgressCards = () => (
    <View className="px-4 mb-6">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row">
          <View className="bg-primary/15 border border-primary/30 rounded-2xl p-4 mr-3 w-40">
            <View className="flex-row items-center mb-2">
              <Feather name="activity" size={20} color={colors.brand} />
              <Text className="text-text font-bold ml-2">Workout Streak</Text>
            </View>
            <Text className="text-text text-2xl font-bold">{stats.currentStreak} days</Text>
            <Text className="text-primary text-sm">Best: {stats.bestStreak} days</Text>
          </View>

          <View className="bg-primary/15 border border-primary/30 rounded-2xl p-4 mr-3 w-40">
            <View className="flex-row items-center mb-2">
              <Feather name="calendar" size={20} color={colors.brand} />
              <Text className="text-text font-bold ml-2">This Month</Text>
            </View>
            <Text className="text-text text-2xl font-bold">{stats.workoutDaysThisMonth} days</Text>
            <Text className="text-primary text-sm">Workout days</Text>
          </View>

          <View className="bg-accent/15 border border-accent/30 rounded-2xl p-4 w-40">
            <View className="flex-row items-center mb-2">
              <Feather name="award" size={20} color={colors.accent} />
              <Text className="text-text font-bold ml-2">Personal Records</Text>
            </View>
            <Text className="text-text text-2xl font-bold">{personalRecords.length}</Text>
            <Text className="text-accent text-sm">Achievements</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderPersonalRecords = () => (
    <View className="px-4 mb-8">
      <Text className="text-text text-lg font-bold mb-3">Personal Records</Text>

      {personalRecords.length > 0 ? (
        personalRecords.slice(0, 5).map((pr, index) => (
          <TouchableOpacity
            key={pr.id}
            className="bg-surface rounded-2xl border border-border p-4 mb-3"
            onPress={() => {
              if (!pr.session_id) return;
              router.push({
                pathname: '/workout-details',
                params: { sessionId: pr.session_id }
              });
            }}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-text font-bold text-lg">{pr.exercise_name}</Text>
              <View className="bg-accent/15 px-3 py-1 rounded-full">
                <Text className="text-accent font-bold">PR 🏆</Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <View>
                <Text className="text-text-light text-sm">Max Weight</Text>
                <Text className="text-text font-bold text-xl">{pr.max_weight}kg</Text>
              </View>

              <View>
                <Text className="text-text-light text-sm">Max Reps</Text>
                <Text className="text-text font-bold text-xl">{pr.max_reps}</Text>
              </View>

              <View>
                <Text className="text-text-light text-sm">Date</Text>
                <Text className="text-text">
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
        <View className="bg-surface rounded-2xl border border-border p-6 items-center">
          <Feather name="award" size={48} color={colors.textLight} />
          <Text className="text-text text-lg font-bold mt-4 mb-2">
            No Personal Records Yet
          </Text>
          <Text className="text-text-light text-center mb-4">
            Set new personal records in your workouts!
          </Text>
        </View>
      )}

      {personalRecords.length > 5 && (
        <TouchableOpacity
          className="bg-surface rounded-2xl border border-border p-4 items-center mt-3"
          onPress={() => router.push('/pr-list' as any)}
        >
          <Text className="text-primary font-bold">
            View All {personalRecords.length} Records →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

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
        <View className="px-4 pt-4 pb-2">
          <Text className="text-text text-3xl font-bold mb-4">Progress</Text>

          {/* Metric Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {[
              { id: 'volume', label: 'Volume', icon: 'bar-chart-2' },
              { id: 'workouts', label: 'Workouts', icon: 'activity' },
              { id: 'calories', label: 'Calories', icon: 'fire' },
              { id: 'sets', label: 'Sets', icon: 'list' }
            ].map((metric) => {
              const selected = selectedMetric === metric.id;
              const iconColor = selected ? colors.onBrand : colors.textLight;
              return (
                <TouchableOpacity
                  key={metric.id}
                  className={`flex-row items-center px-4 py-2 rounded-full mr-2 ${selected ? 'bg-primary' : 'bg-surface-2 border border-border'
                    }`}
                  onPress={() => setSelectedMetric(metric.id)}
                >
                  {metric.icon === 'fire' ?
                    <AntDesign name={metric.icon} size={16} color={iconColor} /> :
                    <Feather name={metric.icon as any} size={16} color={iconColor} />
                  }
                  <Text className={`font-medium ml-2 ${selected ? 'text-on-brand' : 'text-text-light'}`}>{metric.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Period Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {[
              { id: 'week', label: '1 Week' },
              { id: 'month', label: '1 Month' },
              { id: '3months', label: '3 Months' },
              { id: 'year', label: '1 Year' }
            ].map((period) => {
              const selected = selectedPeriod === period.id;
              return (
                <TouchableOpacity
                  key={period.id}
                  className={`px-4 py-2 rounded-full mr-2 ${selected ? 'bg-primary' : 'bg-surface-2 border border-border'
                    }`}
                  onPress={() => setSelectedPeriod(period.id)}
                >
                  <Text className={`font-medium ${selected ? 'text-on-brand' : 'text-text-light'}`}>{period.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Progress Cards */}
        {renderProgressCards()}

        {/* Body Weight */}
        {renderBodyWeightCard()}

        {/* Progress Visualization */}
        <View className="px-4 mb-6">
          <Text className="text-text text-lg font-bold mb-3">
            {selectedMetric === 'volume' && 'Training Volume Progress'}
            {selectedMetric === 'workouts' && 'Workout Frequency'}
            {selectedMetric === 'calories' && 'Calories Burned'}
            {selectedMetric === 'sets' && 'Sets Completed'}
          </Text>

          {renderProgressBars()}
        </View>

        {/* Stats Summary */}
        <View className="px-4 mb-6">
          <Text className="text-text text-lg font-bold mb-3">Statistics</Text>

          <View className="bg-surface rounded-2xl border border-border p-4">
            <View className="flex-row justify-between mb-4">
              <View className="items-center flex-1">
                <Text className="text-text text-2xl font-bold">{stats.totalWorkouts}</Text>
                <Text className="text-text-light">Total Workouts</Text>
              </View>

              <View className="items-center flex-1">
                <Text className="text-text text-2xl font-bold">{stats.totalCalories}</Text>
                <Text className="text-text-light">Calories Burned</Text>
              </View>

              <View className="items-center flex-1">
                <Text className="text-text text-2xl font-bold">{Math.round(stats.totalVolume)}</Text>
                <Text className="text-text-light">Total Volume (kg)</Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Feather name="trending-up" size={20} color={colors.brand} />
                <Text className="text-text font-bold mt-1">{stats.currentStreak}</Text>
                <Text className="text-text-light text-xs">Current Streak</Text>
              </View>

              <View className="items-center flex-1">
                <Feather name="target" size={20} color={colors.brand} />
                <Text className="text-text font-bold mt-1">{stats.bestStreak}</Text>
                <Text className="text-text-light text-xs">Best Streak</Text>
              </View>

              <View className="items-center flex-1">
                <Feather name="calendar" size={20} color={colors.accent} />
                <Text className="text-text font-bold mt-1">{stats.workoutDaysThisMonth}</Text>
                <Text className="text-text-light text-xs">Days This Month</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Personal Records */}
        {renderPersonalRecords()}
      </ScrollView>

      <Modal
        visible={showWeightModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWeightModal(false)}
      >
        <LogWeightModal
          initialWeight={weightHistory[0]?.weight ?? profile?.weight ?? null}
          onClose={() => setShowWeightModal(false)}
          onSaved={handleWeightLogged}
        />
      </Modal>
    </SafeAreaView>
  );
}

interface LogWeightModalProps {
  initialWeight: number | null;
  onClose: () => void;
  onSaved: (entry: WeightEntry) => void;
}

function LogWeightModal({ initialWeight, onClose, onSaved }: LogWeightModalProps) {
  const { vars, mode, colors } = useThemeStore();
  const [weightInput, setWeightInput] = useState(
    initialWeight !== null ? String(initialWeight) : ''
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const today = localDateString();

  const handleSave = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 20 || weight >= 500) {
      showAlert('Invalid Weight', 'Please enter a weight between 20 and 500 kg.');
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      const { data, error } = await supabase.rpc('log_body_weight', { p_weight: weight });
      if (error) throw error;

      await useAuthStore.getState().refreshProfile();

      const row = Array.isArray(data) ? data[0] : data;
      onSaved({
        date: row?.date ?? today,
        weight: row?.weight ?? weight,
      });
    } catch (error) {
      console.error('Error logging body weight:', error);
      showAlert('Error', 'Could not log your weight. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
      <View className="bg-bg rounded-t-3xl p-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text text-2xl font-bold">Log Weight</Text>
          <TouchableOpacity onPress={onClose}>
            <AntDesign name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View className="mb-4">
          <Text className="text-text mb-2 font-medium">Weight (kg)</Text>
          <TextInput
            className="bg-surface-2 border border-border text-text px-4 py-3 rounded-xl"
            placeholder="70"
            placeholderTextColor={colors.textLight}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="numeric"
            autoFocus
          />
        </View>

        <View className="mb-6">
          <Text className="text-text mb-2 font-medium">Date</Text>
          <View className="bg-surface-2 border border-border px-4 py-3 rounded-xl">
            <Text className="text-text-light">{today} (today)</Text>
          </View>
        </View>

        <TouchableOpacity
          className={`bg-primary py-4 rounded-xl mb-3 ${saving ? 'opacity-50' : ''}`}
          disabled={saving}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text className="text-on-brand text-center font-bold text-lg">Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}