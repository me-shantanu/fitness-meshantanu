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

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export default function BrowseTemplatesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { templates, loadTemplates, activateTemplate, loadActivePlan } = useWorkoutStore();
  
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
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
        className="bg-surface rounded-xl p-4 mb-4"
        onPress={() => handleActivateTemplate(template)}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-text text-xl font-bold mb-1">{template.name}</Text>
            {template.description && (
              <Text className="text-text-light text-sm mb-2">{template.description}</Text>
            )}
          </View>
          <View className="bg-blue-500/20 px-3 py-1 rounded">
            <Text className="text-blue-400 font-bold text-sm">Template</Text>
          </View>
        </View>

        <View className="flex-row justify-between mb-3">
          <View className="flex-row items-center">
            <Feather name="calendar" size={16} color="#10B981" />
            <Text className="text-text-light text-sm ml-2">
              {workoutDaysCount} workout days
            </Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="moon" size={16} color="#8B5CF6" />
            <Text className="text-text-light text-sm ml-2">
              {restDaysCount} rest days
            </Text>
          </View>
          <View className="flex-row items-center">
            <Feather name="activity" size={16} color="#3B82F6" />
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
                      day.is_rest_day ? 'bg-purple-500/20' : 'bg-blue-500/20'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        day.is_rest_day ? 'text-purple-400' : 'text-blue-400'
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
          className="bg-blue-600 py-3 rounded-lg mt-3"
          onPress={() => handleActivateTemplate(template)}
        >
          <Text className="text-text text-center font-bold">Activate Template</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const { vars, mode } = useThemeStore();

  const renderActivateModal = () => (
    <Modal
      visible={showActivateModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowActivateModal(false)}
    >
      <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
        <View className="bg-bg rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-2xl font-bold">Activate Template</Text>
            <TouchableOpacity onPress={() => setShowActivateModal(false)}>
              <AntDesign name="close" size={24} color="var(--text)" />
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

              <View className="bg-surface rounded-xl p-4 mb-4">
                <Text className="text-text-light text-sm mb-3">
                  This will deactivate any current workout plan and activate this template as your new plan.
                </Text>
              </View>

              <View className="space-y-4">
                <View>
                  <Text className="text-text-light mb-2">Start Date</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6B7280"
                  />
                </View>
                
                <View>
                  <Text className="text-text-light mb-2">End Date</Text>
                  <TextInput
                    className="bg-surface text-text rounded-xl p-4"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6B7280"
                  />
                </View>
              </View>

              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-xl mt-6"
                onPress={confirmActivation}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-text text-center font-bold text-lg">
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
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()}>
            <AntDesign name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-text text-2xl font-bold ml-4">Templates</Text>
        </View>

        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 mb-4">
          <Feather name="info" size={20} color="#3B82F6" />
          <Text className="text-text-light text-sm ml-3 flex-1">
            Templates are reusable workout plans. Create templates to use them multiple times.
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {templates.length === 0 ? (
          <View className="flex-1 justify-center items-center mt-20">
            <View className="bg-surface rounded-2xl p-8 items-center">
              <MaterialIcons name="fitness-center" size={64} color="#6B7280" />
              <Text className="text-text text-xl font-bold mt-6 mb-3">
                No Templates Yet
              </Text>
              <Text className="text-text-light text-center mb-8">
                Create your first template to reuse it multiple times for different training cycles.
              </Text>

              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-xl w-full items-center"
                onPress={() => router.push('/create-plan' as any)}
              >
                <Text className="text-text font-bold text-lg">Create Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {templates.map(template => renderTemplateCard(template))}
            
            <TouchableOpacity
              className="bg-surface py-4 rounded-xl mb-8 flex-row items-center justify-center border border-blue-500/30"
              onPress={() => router.push('/create-plan' as any)}
            >
              <AntDesign name="plus" size={20} color="#3B82F6" />
              <Text className="text-blue-400 font-bold ml-2">Create New Template</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {renderActivateModal()}
    </SafeAreaView>
  );
}