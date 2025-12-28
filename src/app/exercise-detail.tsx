import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { exerciseService } from '../services/exerciseService';
import { useExerciseStore } from '../store/exerciseStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/useThemeStore';

const { width } = Dimensions.get('window');

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams();
  const { addFavorite, removeFavorite, isFavorite } = useExerciseStore();
  const { vars, mode } = useThemeStore();

  const [exercise, setExercise] = useState(null);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const { user } = useAuthStore();
  const [showAddToPlanModal, setShowAddToPlanModal] = useState(false);
  const [userPlans, setUserPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [addingToPlan, setAddingToPlan] = useState(false);

  useEffect(() => {
    loadExerciseDetail();
    loadUserPlans();
  }, [id, type]);

  const loadExerciseDetail = async () => {
    setLoading(true);
    try {
      let exerciseData = null;
      let imagesData = [];
      let videosData = [];

      if (type === 'warmup' || type === 'cooldown') {
        const allExercises = type === 'warmup'
          ? await exerciseService.getWarmupExercises()
          : await exerciseService.getCooldownExercises();

        exerciseData = allExercises.find(ex => ex.id === id) || null;
      } else {
        exerciseData = await exerciseService.getExerciseById(id as string);

        if (exerciseData) {
          imagesData = await exerciseService.getExerciseImages(id as string);
          videosData = await exerciseService.getExerciseVideos(id as string);
        }
      }

      setExercise(exerciseData);
      setImages(imagesData);
      setVideos(videosData);
    } catch (error) {
      console.error('Error loading exercise detail:', error);
    }
    setLoading(false);
  };

  const loadUserPlans = async () => {
    try {
      const { data: plans, error } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workout_days (
            id,
            day_of_week,
            name,
            is_rest_day
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserPlans(plans || []);
    } catch (error) {
      console.error('Error loading user plans:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!exercise) return;

    if (isFavorite(exercise.id)) {
      await removeFavorite(exercise.id);
    } else {
      await addFavorite(exercise.id, exercise.name, type || 'workout');
    }
  };

  const handleAddToPlan = async () => {
    if (!selectedPlan || !selectedDay || !exercise) {
      Alert.alert('Error', 'Please select a plan and day');
      return;
    }

    if (selectedDay.is_rest_day) {
      Alert.alert('Error', 'Cannot add exercises to rest days');
      return;
    }

    setAddingToPlan(true);
    try {
      // Get the next order index for the day
      const { data: existingExercises, error: fetchError } = await supabase
        .from('planned_exercises')
        .select('order_index')
        .eq('workout_day_id', selectedDay.id)
        .order('order_index', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextOrderIndex = existingExercises?.length > 0
        ? existingExercises[0].order_index + 1
        : 0;

      // Add the exercise to the plan
      const { error: insertError } = await supabase
        .from('planned_exercises')
        .insert({
          workout_day_id: selectedDay.id,
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          exercise_type: type === 'warmup' ? 'warmup' : type === 'cooldown' ? 'cooldown' : 'strength',
          target_sets: type === 'warmup' || type === 'cooldown' ? 1 : 3,
          target_reps: type === 'warmup' || type === 'cooldown' ? 10 : 10,
          target_duration: exercise.duration || null,
          order_index: nextOrderIndex,
          user_id: user.id
        });

      if (insertError) throw insertError;

      Alert.alert('Success', `"${exercise.name}" added to workout plan!`, [
        {
          text: 'View Plan',
          style: 'default',
          onPress: () => {
            setShowAddToPlanModal(false);
            router.push('/(tabs)/workouts');
          }
        },
        {
          text: 'OK',
          style: 'cancel',
          onPress: () => {
            setShowAddToPlanModal(false);
          }
        }
      ]);
    } catch (error: any) {
      console.error('Error adding exercise to plan:', error);
      Alert.alert('Error', error.message || 'Failed to add exercise to plan');
    }
    setAddingToPlan(false);
  };


  const renderAddToPlanModal = () => (
    <Modal
      visible={showAddToPlanModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddToPlanModal(false)}
    >
      <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
        <View className="bg-bg rounded-t-3xl p-6 max-h-3/4">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-2xl font-bold">Add to Workout Plan</Text>
            <TouchableOpacity onPress={() => setShowAddToPlanModal(false)}>
              <AntDesign name="close" size={24} color="var(--text)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Select Plan */}
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-3">Select Plan</Text>
              {userPlans.length === 0 ? (
                <View className="bg-surface rounded-xl p-6 items-center">
                  <MaterialIcons name="fitness-center" size={48} color="#6B7280" />
                  <Text className="text-text text-lg font-bold mt-4 mb-2">
                    No Active Plans
                  </Text>
                  <Text className="text-text-light text-center mb-4">
                    Create a workout plan first to add exercises
                  </Text>
                  <TouchableOpacity
                    className="bg-primary px-6 py-3 rounded-lg"
                    onPress={() => {
                      setShowAddToPlanModal(false);
                      router.push('/create-plan');
                    }}
                  >
                    <Text className="text-bg font-bold">Create Plan</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                userPlans.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    className={`bg-surface rounded-xl p-4 mb-3 ${selectedPlan?.id === plan.id ? 'border-2 border-primary' : ''}`}
                    onPress={() => setSelectedPlan(plan)}
                  >
                    <Text className="text-text font-bold text-lg">{plan.name}</Text>
                    <Text className="text-text-light text-sm">
                      {plan.workout_days?.filter(d => !d.is_rest_day).length} workout days
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Select Day */}
            {selectedPlan && (
              <View className="mb-6">
                <Text className="text-text text-lg font-bold mb-3">Select Day</Text>
                {selectedPlan.workout_days
                  ?.filter(day => !day.is_rest_day)
                  .sort((a, b) => a.day_of_week - b.day_of_week)
                  .map((day) => {
                    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                    return (
                      <TouchableOpacity
                        key={day.id}
                        className={`bg-surface rounded-xl p-4 mb-3 ${selectedDay?.id === day.id ? 'border-2 border-primary' : ''}`}
                        onPress={() => setSelectedDay(day)}
                      >
                        <Text className="text-text font-bold">{daysOfWeek[day.day_of_week]}</Text>
                        <Text className="text-text-light">{day.name || 'Workout Day'}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}

            {/* Exercise Summary */}
            {exercise && (
              <View className="mb-6">
                <Text className="text-text text-lg font-bold mb-3">Exercise</Text>
                <View className="bg-surface rounded-xl p-4">
                  <Text className="text-text font-bold text-lg">{exercise.name}</Text>
                  <Text className="text-text-light">
                    {exercise.category} • {type}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Add Button */}
          {selectedPlan && selectedDay && (
            <TouchableOpacity
              className="bg-primary py-4 rounded-xl mt-4 flex-row items-center justify-center"
              onPress={handleAddToPlan}
              disabled={addingToPlan}
            >
              {addingToPlan ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialIcons name="add-circle-outline" size={24} color="var(--bg)" />
                  <Text className="text-bg text-center font-bold text-lg ml-2">
                    Add to {selectedPlan.name} - {selectedDay.name || 'Selected Day'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );


  const renderImageGallery = () => {
    if (images.length === 0) return null;

    return (
      <View className="mb-6">
        <Text className="text-text font-bold text-lg mb-3 px-4">Exercise Images</Text>

        {/* Main Image */}
        <View className="relative">
          <Image
            source={{ uri: images[selectedImageIndex].image }}
            style={{ width: width, height: width * 0.75 }}
            resizeMode="contain"
            className="bg-surface"
          />

          {images.length > 1 && (
            <>
              {/* Previous Button */}
              {selectedImageIndex > 0 && (
                <TouchableOpacity
                  className="absolute left-4 top-1/2 -mt-6 bg-black/50 w-12 h-12 rounded-full items-center justify-center"
                  onPress={() => setSelectedImageIndex(prev => prev - 1)}
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
              )}

              {/* Next Button */}
              {selectedImageIndex < images.length - 1 && (
                <TouchableOpacity
                  className="absolute right-4 top-1/2 -mt-6 bg-black/50 w-12 h-12 rounded-full items-center justify-center"
                  onPress={() => setSelectedImageIndex(prev => prev + 1)}
                >
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
              )}

              {/* Image Counter */}
              <View className="absolute bottom-4 right-4 bg-black/70 px-3 py-1.5 rounded-full">
                <Text className="text-white text-sm font-medium">
                  {selectedImageIndex + 1} / {images.length}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 px-4"
          >
            {images.map((img, index) => (
              <TouchableOpacity
                key={img.id}
                onPress={() => setSelectedImageIndex(index)}
                className={`mr-2 ${selectedImageIndex === index ? 'border-2 border-primary' : 'border border-surface'} rounded-lg overflow-hidden`}
              >
                <Image
                  source={{ uri: img.image }}
                  className="w-20 h-20 bg-surface"
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderDetailContent = () => {
    if (!exercise) return null;

    return (
      <View>
        {/* Image Gallery
        {renderImageGallery()} */}

        <View className="px-4">
          {/* Basic Info */}
          <View className="mb-6">
            <Text className="text-text text-3xl font-bold mb-3">{exercise.name}</Text>

            <View className="flex-row items-center flex-wrap mb-4">
              <View className={`px-3 py-2 rounded-full mr-2 mb-2 bg-brand`}>
                <Text className="text-text text-sm font-bold">{exercise.category}</Text>
              </View>

              {exercise.difficulty && (
                <View className="bg-surface px-3 py-2 rounded-full mr-2 mb-2">
                  <Text className="text-text text-sm font-medium">{exercise.difficulty}</Text>
                </View>
              )}

              {exercise.duration && (
                <View className="flex-row items-center bg-surface px-3 py-2 rounded-full mr-2 mb-2">
                  <MaterialIcons name="timer" size={16} color="var(--text)" />
                  <Text className="text-text text-sm font-medium ml-1">{exercise.duration}</Text>
                </View>
              )}

              {exercise.sets && (
                <View className="bg-surface px-3 py-2 rounded-full mb-2">
                  <Text className="text-text text-sm font-medium">{exercise.sets}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Description */}
          {exercise.description && (
            <View className="mb-6">
              <Text className="text-text font-bold text-lg mb-3">Description</Text>
              <View className="bg-surface rounded-xl p-4">
                <Text className="text-text leading-6 text-base">
                  {exercise.description}
                </Text>
              </View>
            </View>
          )}

          {/* Equipment */}
          {exercise.equipment && exercise.equipment.length > 0 && (
            <View className="mb-6">
              <Text className="text-text font-bold text-lg mb-3">Equipment Needed</Text>
              <View className="flex-row flex-wrap">
                {exercise.equipment.map((eq, index) => (
                  <View key={index} className="bg-surface px-4 py-2.5 rounded-full mr-2 mb-2">
                    <Text className="text-text font-medium">{eq.name || eq}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Muscles Targeted */}
          {(exercise.muscles?.length > 0 || exercise.muscles_secondary?.length > 0) && (
            <View className="mb-6">
              <Text className="text-text font-bold text-lg mb-3">Muscles Targeted</Text>

              <View className="bg-surface rounded-xl p-4">
                {exercise.muscles?.length > 0 && (
                  <View className="mb-3">
                    <Text className="text-text font-bold mb-2 text-base">Primary Muscles:</Text>
                    <View className="flex-row flex-wrap">
                      {exercise.muscles.map((muscle, index) => (
                        <View key={index} className="bg-text px-3 py-2 rounded-full mr-2 mb-2">
                          <Text className="text-bg font-bold">{muscle.name_en || muscle.name || muscle}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {exercise.muscles_secondary?.length > 0 && (
                  <View>
                    <Text className="text-text font-bold mb-2 text-base">Secondary Muscles:</Text>
                    <View className="flex-row flex-wrap">
                      {exercise.muscles_secondary.map((muscle, index) => (
                        <View key={index} className="bg-text px-3 py-2 rounded-full mr-2 mb-2">
                          <Text className="text-bg font-medium">{muscle.name_en || muscle.name || muscle}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Benefits */}
          {exercise.benefits && exercise.benefits.length > 0 && (
            <View className="mb-6">
              <Text className="text-text font-bold text-lg mb-3">Benefits</Text>
              <View className="bg-surface rounded-xl p-4">
                {exercise.benefits.map((benefit, index) => (
                  <View key={index} className="flex-row items-start mb-3">
                    <AntDesign name="star" size={20} color="#F59E0B" />
                    <Text className="text-text ml-3 flex-1 leading-6">{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Calories (for warmup/cooldown) */}
          {exercise.calories && (
            <View className="mb-6">
              <Text className="text-text font-bold text-lg mb-3">Calories Burned</Text>
              <View className="bg-surface rounded-xl p-4">
                <View className="flex-row items-center">
                  <MaterialIcons name="local-fire-department" size={24} color="#F59E0B" />
                  <Text className="text-text ml-3 text-lg font-medium">{exercise.calories}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Instructions for Warmup/Cooldown */}
          {(type === 'warmup' || type === 'cooldown') && (
            <View className="mb-6">
              <Text className="text-text font-bold text-lg mb-3">
                {type === 'warmup' ? 'Warmup Guidelines' : 'Cooldown Guidelines'}
              </Text>

              <View className="bg-surface rounded-xl p-4">
                {type === 'warmup' ? (
                  <>
                    <View className="flex-row items-start mb-3">
                      <Feather name="check-circle" size={20} color="#10B981" />
                      <Text className="text-text ml-3 flex-1 leading-6">
                        Perform before your main workout to prevent injury
                      </Text>
                    </View>
                    <View className="flex-row items-start mb-3">
                      <Feather name="check-circle" size={20} color="#10B981" />
                      <Text className="text-text ml-3 flex-1 leading-6">
                        Focus on dynamic movements, not static stretching
                      </Text>
                    </View>
                    <View className="flex-row items-start">
                      <Feather name="check-circle" size={20} color="#10B981" />
                      <Text className="text-text ml-3 flex-1 leading-6">
                        Gradually increase intensity to raise heart rate
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View className="flex-row items-start mb-3">
                      <Feather name="check-circle" size={20} color="#10B981" />
                      <Text className="text-text ml-3 flex-1 leading-6">
                        Perform after your workout to aid recovery
                      </Text>
                    </View>
                    <View className="flex-row items-start mb-3">
                      <Feather name="check-circle" size={20} color="#10B981" />
                      <Text className="text-text ml-3 flex-1 leading-6">
                        Focus on static stretching, holding each stretch for 30 seconds
                      </Text>
                    </View>
                    <View className="flex-row items-start">
                      <Feather name="check-circle" size={20} color="#10B981" />
                      <Text className="text-text ml-3 flex-1 leading-6">
                        Breathe deeply and relax into each stretch
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="var(--primary)" />
          <Text className="text-text mt-4">Loading exercise details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center px-4">
          <AntDesign name="warning" size={48} color="#EF4444" />
          <Text className="text-text text-xl mt-4 text-center">Exercise not found</Text>
          <Text className="text-text-light text-center mt-2">
            This exercise may have been removed or doesn't exist
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-4 rounded-lg mt-6"
            onPress={() => router.back()}
          >
            <Text className="text-text font-bold text-base">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 !bg-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 bg-bg border-b border-surface">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <AntDesign name="arrow-left" size={24} color="var(--text)" />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text className="text-text font-bold text-lg">Exercise Details</Text>
        </View>

        <TouchableOpacity onPress={toggleFavorite} className="p-2">
           {isFavorite(exercise.id) ?
              <AntDesign
                name={'heart'}
                size={24}
                color={'#EF4444'}
              /> :
              <FontAwesome name="heart-o" size={24} color={vars['--text-light'] as string} />
            }
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 py-3 bg-bg border-b border-surface">
        <TouchableOpacity
          className={`flex-1 py-3 ${activeTab === 'details' ? 'bg-brand' : 'bg-surface'
            }`}
          onPress={() => setActiveTab('details')}
        >
          <Text className={`text-center font-bold ${activeTab === 'details' ? 'text-text' : 'text-text-light'
            }`}>
            Details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 ${activeTab === 'variations' ? 'bg-brand' : 'bg-surface'
            }`}
          onPress={() => setActiveTab('variations')}
        >
          <Text className={`text-center font-bold ${activeTab === 'variations' ? 'text-text' : 'text-text-light'
            }`}>
            Variations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 rounded-r-lg ${activeTab === 'tips' ? 'bg-brand' : 'bg-surface'
            }`}
          onPress={() => setActiveTab('tips')}
        >
          <Text className={`text-center font-bold ${activeTab === 'tips' ? 'text-text' : 'text-text-light'
            }`}>
            Pro Tips
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {activeTab === 'details' && renderDetailContent()}

        {activeTab === 'variations' && (
          <View className="px-4 pt-4">
            <Text className="text-text font-bold text-2xl mb-4">Exercise Variations</Text>
            <View className="bg-surface rounded-xl p-5">
              <Text className="text-text mb-5 leading-6 text-base">
                Try these variations to target different muscle groups or adjust difficulty level:
              </Text>

              {type === 'workout' ? (
                <>
                  <View className="mb-5">
                    <Text className="text-text font-bold mb-2 text-lg">💡 Easier Variation</Text>
                    <Text className="text-text-light leading-6">
                      • Reduce weight or resistance{'\n'}
                      • Use assistance bands{'\n'}
                      • Perform with bodyweight only{'\n'}
                      • Focus on perfecting form before intensity
                    </Text>
                  </View>

                  <View className="mb-5">
                    <Text className="text-text font-bold mb-2 text-lg">🔥 Harder Variation</Text>
                    <Text className="text-text-light leading-6">
                      • Increase weight progressively{'\n'}
                      • Add pause reps at peak contraction{'\n'}
                      • Use tempo variations (3-1-3){'\n'}
                      • Reduce rest time between sets{'\n'}
                      • Add drop sets or supersets
                    </Text>
                  </View>

                  <View>
                    <Text className="text-text font-bold mb-2 text-lg">🔄 Alternative Equipment</Text>
                    <Text className="text-text-light leading-6">
                      • Dumbbells for unilateral work{'\n'}
                      • Kettlebells for dynamic movements{'\n'}
                      • Resistance bands for constant tension{'\n'}
                      • Cable machines for smooth resistance{'\n'}
                      • Bodyweight for functional strength
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View className="mb-5">
                    <Text className="text-text font-bold mb-2 text-lg">🌱 Beginner Variation</Text>
                    <Text className="text-text-light leading-6">
                      • Reduce range of motion by 30-50%{'\n'}
                      • Hold stretches for 15-20 seconds{'\n'}
                      • Perform fewer repetitions (5-8){'\n'}
                      • Use support (wall, chair) if needed{'\n'}
                      • Focus on breathing and relaxation
                    </Text>
                  </View>

                  <View>
                    <Text className="text-text font-bold mb-2 text-lg">⚡ Advanced Variation</Text>
                    <Text className="text-text-light leading-6">
                      • Increase range of motion gradually{'\n'}
                      • Hold stretches for 45-60 seconds{'\n'}
                      • Add dynamic elements or pulses{'\n'}
                      • Combine with breathing techniques{'\n'}
                      • Progress to more challenging variations
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {activeTab === 'tips' && (
          <View className="px-4 pt-4">
            <Text className="text-text font-bold text-2xl mb-4">Pro Tips & Safety</Text>
            <View className="bg-surface rounded-xl p-5">
              <View className="mb-5">
                <Text className="text-text font-bold mb-3 text-lg">💡 Form & Technique</Text>
                <Text className="text-text mb-2">• Maintain neutral spine alignment</Text>
                <Text className="text-text mb-2">• Control the movement, avoid momentum</Text>
                <Text className="text-text mb-2">• Exhale on exertion, inhale on return</Text>
                <Text className="text-text mb-2">• Keep core engaged throughout</Text>
                <Text className="text-text">• Focus on mind-muscle connection</Text>
              </View>

              <View className="mb-5">
                <Text className="text-text font-bold mb-3 text-lg">⚠️ Common Mistakes</Text>
                <Text className="text-text mb-2">• Rushing through repetitions</Text>
                <Text className="text-text mb-2">• Using excessive weight with poor form</Text>
                <Text className="text-text mb-2">• Not engaging target muscles properly</Text>
                <Text className="text-text mb-2">• Holding breath during exercise</Text>
                <Text className="text-text">• Skipping warmup sets</Text>
              </View>

              <View className="mb-5">
                <Text className="text-text font-bold mb-3 text-lg">🎯 Progression Strategy</Text>
                <Text className="text-text mb-2">• Master form before adding weight</Text>
                <Text className="text-text mb-2">• Apply progressive overload gradually</Text>
                <Text className="text-text mb-2">• Track all workouts and progress</Text>
                <Text className="text-text mb-2">• Allow 48-72 hours recovery</Text>
                <Text className="text-text">• Deload every 4-6 weeks</Text>
              </View>

              <View>
                <Text className="text-text font-bold mb-3 text-lg">🛡️ Safety Tips</Text>
                <Text className="text-text mb-2">• Always warmup before exercising</Text>
                <Text className="text-text mb-2">• Use spotter for heavy lifts</Text>
                <Text className="text-text mb-2">• Check equipment before use</Text>
                <Text className="text-text mb-2">• Stop if you feel sharp pain</Text>
                <Text className="text-text">• Stay hydrated throughout workout</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View className="h-32" />
      </ScrollView>

      {/* Add to Workout Button */}
      <View className="px-4 pb-4 pt-3 bg-bg border-t border-surface">
        <TouchableOpacity
          className="bg-brand py-4 rounded-xl flex-row items-center justify-center"
          onPress={() => setShowAddToPlanModal(true)}
        >
          <MaterialIcons name="add-circle-outline" size={24} color="var(--text)" />
          <Text className="text-text text-center font-bold text-lg ml-2">
            Add to Workout Plan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add to Plan Modal */}
      {renderAddToPlanModal()}
    </SafeAreaView>
  );
}