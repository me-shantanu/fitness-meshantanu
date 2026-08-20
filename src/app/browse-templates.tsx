// app/browse-templates.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useWorkoutStore } from '../store/workoutStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import { useThemeStore } from '@/store/useThemeStore';
import { WorkoutPlan } from '@/types/workout';
import { showAlert } from '@/utils/alert';
import { STARTER_TEMPLATES, StarterTemplate } from '@/data/starterTemplates';
import { workoutService } from '../services/workoutService';
import { localDateString } from '@/utils/date';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export default function BrowseTemplatesScreen() {
  const router = useRouter();
  const { vars, mode, colors } = useThemeStore();
  const { user } = useAuthStore();
  const { templates, loadTemplates, activateTemplate, loadActivePlan } = useWorkoutStore();
  
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [usingStarterId, setUsingStarterId] = useState<string | null>(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutPlan | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadUserTemplates();
    }
  }, [user?.id]);

  const loadUserTemplates = async () => {
    if (!user?.id) return;
    setLoading(true);
    await loadTemplates(user.id);
    setLoading(false);
  };

  const handleActivateTemplate = (template: WorkoutPlan) => {
    // Set default dates
    const today = new Date();
    const fourWeeksLater = new Date(today);
    fourWeeksLater.setDate(today.getDate() + 28);
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(fourWeeksLater.toISOString().split('T')[0]);
    setSelectedTemplate(template);
    setShowActivateModal(true);
  };

  const confirmActivation = async () => {
    if (!user?.id || !selectedTemplate?.id) return;

    if (!startDate || !endDate) {
      showAlert('Error', 'Please select start and end dates');
      return;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      showAlert('Error', 'Please enter valid dates in YYYY-MM-DD format');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showAlert('Error', 'Start date must be on or before the end date');
      return;
    }

    console.log('🎯 Activating template:', selectedTemplate.id);
    console.log('Template name:', selectedTemplate.name);
    console.log('Start date:', startDate);
    console.log('End date:', endDate);

    setActivating(true);
    const success = await activateTemplate(user.id, selectedTemplate.id, startDate, endDate);
    setActivating(false);
    setShowActivateModal(false);

    if (success) {
      console.log('✅ Template activated successfully');
      showAlert(
        'Success',
        'Template activated as your workout plan!',
        [{ 
          text: 'OK', 
          onPress: () => {
            loadActivePlan(user.id);
            router.replace('/(tabs)/workout' as any);
          }
        }]
      );
    } else {
      console.error('❌ Failed to activate template');
      showAlert('Error', 'Failed to activate template. Please try again.');
    }
  };

  const handleUseStarter = (starter: StarterTemplate) => {
    if (usingStarterId) return;
    showAlert(
      'Use this plan?',
      `"${starter.name}" will become your active plan.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use plan', onPress: () => createFromStarter(starter) },
      ]
    );
  };

  const createFromStarter = async (starter: StarterTemplate) => {
    if (!user?.id || usingStarterId) return;

    setUsingStarterId(starter.id);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 90);

      const result = await workoutService.createWeeklyPlan(
        user.id,
        {
          name: starter.name,
          description: starter.description,
          startDate: localDateString(start),
          endDate: localDateString(end),
          isTemplate: false,
        },
        starter.days
      );

      if (result.success) {
        await loadActivePlan(user.id);
        router.replace('/(tabs)/workout' as any);
      } else {
        showAlert('Error', 'Could not create the plan. Please try again.');
      }
    } finally {
      setUsingStarterId(null);
    }
  };

  const renderStarterCard = (starter: StarterTemplate) => {
    const workoutDays = starter.days.filter(d => !d.isRestDay);
    const daySummary = `${workoutDays
      .map(d => DAYS_OF_WEEK[d.dayOfWeek])
      .join(' · ')} — ${workoutDays.length} workouts / week`;
    const isBeginner = starter.level === 'Beginner';
    const inFlight = usingStarterId === starter.id;

    return (
      <View
        key={starter.id}
        className="bg-surface rounded-2xl border border-border p-4 mb-4"
      >
        <View className="flex-row justify-between items-start mb-2">
          <Text className="text-text text-xl font-bold flex-1 mr-3">
            {starter.name}
          </Text>
          <View
            className={`px-3 py-1 rounded ${
              isBeginner ? 'bg-primary/15' : 'bg-accent/15'
            }`}
          >
            <Text
              className={`font-bold text-sm ${
                isBeginner ? 'text-primary' : 'text-accent'
              }`}
            >
              {starter.level}
            </Text>
          </View>
        </View>

        <Text className="text-text-light text-sm mb-2">{starter.description}</Text>
        <Text className="text-text-light text-xs mb-3">{daySummary}</Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Use plan ${starter.name}`}
          className={`bg-primary py-3 rounded-lg ${
            usingStarterId ? 'opacity-50' : ''
          }`}
          disabled={!!usingStarterId}
          onPress={() => handleUseStarter(starter)}
        >
          {inFlight ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text className="text-on-brand text-center font-bold">
              Use this plan
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderTemplateCard = (template: WorkoutPlan) => {
    const workoutDaysCount = template.workout_days?.filter(d => !d.is_rest_day).length || 0;
    const restDaysCount = template.workout_days?.filter(d => d.is_rest_day).length || 0;
    const totalExercises = template.workout_days?.reduce(
      (total, day) => total + (day.planned_exercises?.length || 0),
      0
    ) || 0;

    return (
      <TouchableOpacity
        key={template.id}
        accessibilityRole="button"
        accessibilityLabel={`Activate template ${template.name}`}
        className="bg-surface rounded-2xl border border-border p-4 mb-4"
        onPress={() => handleActivateTemplate(template)}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-text text-xl font-bold mb-1">{template.name}</Text>
            {template.description && (
              <Text className="text-text-light text-sm mb-2">{template.description}</Text>
            )}
          </View>
          <View className="bg-primary/15 px-3 py-1 rounded">
            <Text className="text-primary font-bold text-sm">Template</Text>
          </View>
        </View>

        <View className="flex-row justify-between mb-3">
          <View className="flex-row items-center">
            <Feather name="calendar" size={16} color={colors.brand} />
            <Text className="text-text-light text-sm ml-2">
              {workoutDaysCount} workout days
            </Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="moon" size={16} color={colors.textLight} />
            <Text className="text-text-light text-sm ml-2">
              {restDaysCount} rest days
            </Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="activity" size={16} color={colors.brand} />
            <Text className="text-text-light text-sm ml-2">
              {totalExercises} exercises
            </Text>
          </View>
        </View>

        {template.workout_days && template.workout_days.length > 0 && (
          <View>
            <Text className="text-text-light text-sm mb-2">Weekly Schedule:</Text>
            <View className="flex-row flex-wrap">
              {template.workout_days
                .sort((a, b) => a.day_of_week - b.day_of_week)
                .map((day) => (
                  <View
                    key={day.id}
                    className={`px-2 py-1 rounded mr-2 mb-2 ${
                      day.is_rest_day ? 'bg-surface-2 border border-border' : 'bg-primary/15'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        day.is_rest_day ? 'text-text-light' : 'text-primary'
                      }`}
                    >
                      {DAYS_OF_WEEK[day.day_of_week]}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          className="bg-primary py-3 rounded-lg mt-3"
          onPress={() => handleActivateTemplate(template)}
        >
          <Text className="text-on-brand text-center font-bold">Activate Template</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderActivateModal = () => (
    <Modal
      visible={showActivateModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowActivateModal(false)}
    >
      <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
        <View className="bg-bg rounded-t-3xl p-6" accessibilityViewIsModal={true}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-2xl font-bold">Activate Template</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close activate template dialog"
              onPress={() => setShowActivateModal(false)}
            >
              <AntDesign name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedTemplate && (
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-2">
                {selectedTemplate.name}
              </Text>
              {selectedTemplate.description && (
                <Text className="text-text-light mb-4">
                  {selectedTemplate.description}
                </Text>
              )}

              <View className="bg-surface rounded-2xl border border-border p-4 mb-4">
                <Text className="text-text-light text-sm mb-3">
                  This will deactivate any current workout plan and activate this template as your new plan.
                </Text>
              </View>

              <View className="space-y-4">
                <View>
                  <Text className="text-text-light mb-2">Start Date</Text>
                  <TextInput
                    className="bg-surface-2 border border-border text-text rounded-xl p-4"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textLight}
                    accessibilityLabel="Start Date"
                  />
                </View>
                
                <View>
                  <Text className="text-text-light mb-2">End Date</Text>
                  <TextInput
                    className="bg-surface-2 border border-border text-text rounded-xl p-4"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textLight}
                    accessibilityLabel="End Date"
                  />
                </View>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                className="bg-primary py-4 rounded-xl mt-6"
                onPress={confirmActivation}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text className="text-on-brand text-center font-bold text-lg">
                    Activate Plan
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
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
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
          >
            <AntDesign name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-text text-2xl font-bold ml-4">Templates</Text>
        </View>

        <View className="flex-row items-center bg-surface rounded-2xl border border-border px-4 py-3 mb-4">
          <Feather name="info" size={20} color={colors.brand} />
          <Text className="text-text-light text-sm ml-3 flex-1">
            Templates are reusable workout plans. Create templates to use them multiple times.
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        <Text className="text-text text-lg font-bold mb-3">Starter plans</Text>
        {STARTER_TEMPLATES.map(starter => renderStarterCard(starter))}

        <Text className="text-text text-lg font-bold mb-3 mt-2">My templates</Text>
        {templates.length === 0 ? (
          <View className="bg-surface rounded-2xl border border-border p-6 items-center mb-8">
            <MaterialIcons name="fitness-center" size={48} color={colors.textLight} />
            <Text className="text-text text-lg font-bold mt-4 mb-2">
              No templates yet
            </Text>
            <Text className="text-text-light text-center mb-6">
              Templates you save from the plan wizard appear here, ready to reuse for future training cycles.
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              className="bg-primary py-4 rounded-xl w-full items-center"
              onPress={() => router.push('/create-plan' as any)}
            >
              <Text className="text-on-brand font-bold text-lg">Create Template</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {templates.map(template => renderTemplateCard(template))}

            <TouchableOpacity
              accessibilityRole="button"
              className="bg-surface py-4 rounded-xl mb-8 flex-row items-center justify-center border border-primary/30"
              onPress={() => router.push('/create-plan' as any)}
            >
              <AntDesign name="plus" size={20} color={colors.brand} />
              <Text className="text-primary font-bold ml-2">Create New Template</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {renderActivateModal()}
    </SafeAreaView>
  );
}