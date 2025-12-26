import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { exerciseService } from '../services/exerciseService';
import { useExerciseStore } from '../store/exerciseStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams();
  const { addFavorite, removeFavorite, isFavorite } = useExerciseStore();
  
  const [exercise, setExercise] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    loadExerciseDetail();
  }, [id, type]);

  const loadExerciseDetail = async () => {
    setLoading(true);
    try {
      let exerciseData = null;
      let imagesData = [];
      
      if (type === 'warmup' || type === 'cooldown') {
        // For custom warmup/cooldown exercises
        const allExercises = type === 'warmup' 
          ? await exerciseService.getWarmupExercises()
          : await exerciseService.getCooldownExercises();
        
        exerciseData = allExercises.find(ex => ex.id === id) || null;
      } else {
        // For workout exercises from wger API
        exerciseData = await exerciseService.getExerciseById(id);
        imagesData = await exerciseService.getExerciseImages(id);
      }
      
      setExercise(exerciseData);
      setImages(imagesData);
    } catch (error) {
      console.error('Error loading exercise detail:', error);
    }
    setLoading(false);
  };

  const toggleFavorite = async () => {
    if (!exercise) return;
    
    if (isFavorite(exercise.id)) {
      await removeFavorite(exercise.id);
    } else {
      await addFavorite(exercise.id, exercise.name);
    }
  };

  const openVideo = () => {
    if (exercise?.video_url) {
      Linking.openURL(exercise.video_url);
    }
  };

  const renderDetailContent = () => {
    if (!exercise) return null;

    return (
      <View className="px-4">
        {/* Basic Info */}
        <View className="mb-6">
          <Text className="text-white text-3xl font-bold mb-2">{exercise.name}</Text>
          
          <View className="flex-row items-center mb-4">
            <View className={`px-3 py-1 rounded-full mr-3 ${
              exercise.category === 'Warmup' ? 'bg-orange-500' :
              exercise.category === 'Cooldown' ? 'bg-blue-500' :
              'bg-gray-700'
            }`}>
              <Text className="text-white font-medium">{exercise.category}</Text>
            </View>
            
            {exercise.duration && (
              <View className="flex-row items-center">
                <MaterialIcons name="timer" size={16} color="#9CA3AF" />
                <Text className="text-gray-400 ml-1">{exercise.duration}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {exercise.description && (
          <View className="mb-6">
            <Text className="text-blue-400 font-bold text-lg mb-3">Description</Text>
            <Text className="text-gray-300 leading-6 text-base">
              {exercise.description}
            </Text>
          </View>
        )}

        {/* Video Link */}
        {exercise.video_url && (
          <TouchableOpacity 
            className="bg-red-600 rounded-xl p-4 mb-6 flex-row items-center justify-center"
            onPress={openVideo}
          >
            <FontAwesome name="youtube-play" size={24} color="white" />
            <Text className="text-white font-bold text-lg ml-3">Watch Tutorial on YouTube</Text>
          </TouchableOpacity>
        )}

        {/* Images Gallery */}
        {images.length > 0 && (
          <View className="mb-6">
            <Text className="text-blue-400 font-bold text-lg mb-3">Exercise Images</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {images.map((img) => (
                <Image
                  key={img.id}
                  source={{ uri: img.image }}
                  className="w-64 h-64 rounded-lg mr-3 bg-gray-800"
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Equipment */}
        {exercise.equipment && exercise.equipment.length > 0 && (
          <View className="mb-6">
            <Text className="text-blue-400 font-bold text-lg mb-3">Equipment Needed</Text>
            <View className="flex-row flex-wrap">
              {exercise.equipment.map((eq, index) => (
                <View key={index} className="bg-gray-800 px-4 py-2 rounded-full mr-2 mb-2">
                  <Text className="text-white">{eq.name || eq}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Muscles Targeted */}
        {(exercise.muscles?.length > 0 || exercise.muscles_secondary?.length > 0) && (
          <View className="mb-6">
            <Text className="text-blue-400 font-bold text-lg mb-3">Muscles Targeted</Text>
            
            {exercise.muscles?.length > 0 && (
              <View className="mb-3">
                <Text className="text-gray-400 mb-2">Primary Muscles:</Text>
                <View className="flex-row flex-wrap">
                  {exercise.muscles.map((muscle, index) => (
                    <View key={index} className="bg-blue-600 px-4 py-2 rounded-full mr-2 mb-2">
                      <Text className="text-white font-medium">{muscle.name_en || muscle.name || muscle}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {exercise.muscles_secondary?.length > 0 && (
              <View>
                <Text className="text-gray-400 mb-2">Secondary Muscles:</Text>
                <View className="flex-row flex-wrap">
                  {exercise.muscles_secondary.map((muscle, index) => (
                    <View key={index} className="bg-gray-700 px-4 py-2 rounded-full mr-2 mb-2">
                      <Text className="text-white">{muscle.name_en || muscle.name || muscle}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Instructions for Warmup/Cooldown */}
        {(type === 'warmup' || type === 'cooldown') && (
          <View className="mb-6">
            <Text className="text-blue-400 font-bold text-lg mb-3">
              {type === 'warmup' ? 'Warmup Instructions' : 'Cooldown Instructions'}
            </Text>
            
            <View className="bg-gray-800 rounded-xl p-4">
              {type === 'warmup' ? (
                <>
                  <View className="flex-row items-start mb-3">
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text className="text-gray-300 ml-3 flex-1">
                      Perform before your main workout to prevent injury
                    </Text>
                  </View>
                  <View className="flex-row items-start mb-3">
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text className="text-gray-300 ml-3 flex-1">
                      Focus on dynamic movements, not static stretching
                    </Text>
                  </View>
                  <View className="flex-row items-start">
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text className="text-gray-300 ml-3 flex-1">
                      Gradually increase intensity to raise heart rate
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View className="flex-row items-start mb-3">
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text className="text-gray-300 ml-3 flex-1">
                      Perform after your workout to aid recovery
                    </Text>
                  </View>
                  <View className="flex-row items-start mb-3">
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text className="text-gray-300 ml-3 flex-1">
                      Focus on static stretching, holding each stretch for 30 seconds
                    </Text>
                  </View>
                  <View className="flex-row items-start">
                    <Feather name="check-circle" size={20} color="#10B981" />
                    <Text className="text-gray-300 ml-3 flex-1">
                      Breathe deeply and relax into each stretch
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Benefits */}
        <View className="mb-6">
          <Text className="text-blue-400 font-bold text-lg mb-3">Benefits</Text>
          <View className="bg-gray-800 rounded-xl p-4">
            <View className="flex-row items-start mb-3">
              <AntDesign name="star" size={20} color="#F59E0B" />
              <Text className="text-gray-300 ml-3 flex-1">
                Improves mobility and flexibility
              </Text>
            </View>
            <View className="flex-row items-start mb-3">
              <AntDesign name="star" size={20} color="#F59E0B" />
              <Text className="text-gray-300 ml-3 flex-1">
                Reduces risk of injury
              </Text>
            </View>
            <View className="flex-row items-start">
              <AntDesign name="star" size={20} color="#F59E0B" />
              <Text className="text-gray-300 ml-3 flex-1">
                Enhances workout performance
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="flex-1 justify-center items-center">
          <AntDesign name="warning" size={48} color="#EF4444" />
          <Text className="text-white text-xl mt-4">Exercise not found</Text>
          <TouchableOpacity 
            className="bg-blue-600 px-6 py-3 rounded-lg mt-4"
            onPress={() => router.back()}
          >
            <Text className="text-white font-bold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <AntDesign name="arrowleft" size={24} color="white" />
        </TouchableOpacity>
        
        <Text className="text-white font-bold text-lg">{exercise.category}</Text>
        
        <TouchableOpacity onPress={toggleFavorite}>
          <AntDesign
            name={isFavorite(exercise.id) ? 'heart' : 'hearto'}
            size={24}
            color={isFavorite(exercise.id) ? '#EF4444' : 'white'}
          />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 mb-4">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-l-lg ${
            activeTab === 'details' ? 'bg-blue-600' : 'bg-gray-800'
          }`}
          onPress={() => setActiveTab('details')}
        >
          <Text className={`text-center font-medium ${
            activeTab === 'details' ? 'text-white' : 'text-gray-400'
          }`}>
            Details
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className={`flex-1 py-3 ${
            activeTab === 'variations' ? 'bg-blue-600' : 'bg-gray-800'
          }`}
          onPress={() => setActiveTab('variations')}
        >
          <Text className={`text-center font-medium ${
            activeTab === 'variations' ? 'text-white' : 'text-gray-400'
          }`}>
            Variations
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className={`flex-1 py-3 rounded-r-lg ${
            activeTab === 'tips' ? 'bg-blue-600' : 'bg-gray-800'
          }`}
          onPress={() => setActiveTab('tips')}
        >
          <Text className={`text-center font-medium ${
            activeTab === 'tips' ? 'text-white' : 'text-gray-400'
          }`}>
            Tips
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'details' && renderDetailContent()}
        
        {activeTab === 'variations' && (
          <View className="px-4">
            <Text className="text-blue-400 font-bold text-lg mb-4">Exercise Variations</Text>
            <View className="bg-gray-800 rounded-xl p-4">
              <Text className="text-gray-300 mb-3">
                Try these variations to target different muscle groups or adjust difficulty:
              </Text>
              
              {type === 'workout' && (
                <>
                  <View className="mb-3">
                    <Text className="text-white font-bold mb-1">• Easier Variation</Text>
                    <Text className="text-gray-400">
                      Reduce weight, use resistance bands, or perform with bodyweight only
                    </Text>
                  </View>
                  
                  <View className="mb-3">
                    <Text className="text-white font-bold mb-1">• Harder Variation</Text>
                    <Text className="text-gray-400">
                      Increase weight, add pauses at peak contraction, or reduce rest time
                    </Text>
                  </View>
                  
                  <View>
                    <Text className="text-white font-bold mb-1">• Alternative Equipment</Text>
                    <Text className="text-gray-400">
                      Try with dumbbells, kettlebells, or machines instead
                    </Text>
                  </View>
                </>
              )}
              
              {(type === 'warmup' || type === 'cooldown') && (
                <>
                  <View className="mb-3">
                    <Text className="text-white font-bold mb-1">• Beginner Variation</Text>
                    <Text className="text-gray-400">
                      Reduce range of motion, hold for shorter duration
                    </Text>
                  </View>
                  
                  <View>
                    <Text className="text-white font-bold mb-1">• Advanced Variation</Text>
                    <Text className="text-gray-400">
                      Increase range of motion, add dynamic elements, hold for longer
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
        
        {activeTab === 'tips' && (
          <View className="px-4">
            <Text className="text-blue-400 font-bold text-lg mb-4">Pro Tips</Text>
            <View className="bg-gray-800 rounded-xl p-4">
              <View className="mb-4">
                <Text className="text-white font-bold mb-2">💡 Form Tips:</Text>
                <Text className="text-gray-300">
                  • Maintain proper posture throughout the movement
                </Text>
                <Text className="text-gray-300">
                  • Control the movement, don't use momentum
                </Text>
                <Text className="text-gray-300">
                  • Breathe out during exertion, inhale during relaxation
                </Text>
              </View>
              
              <View className="mb-4">
                <Text className="text-white font-bold mb-2">⚠️ Common Mistakes:</Text>
                <Text className="text-gray-300">
                  • Rushing through the movement
                </Text>
                <Text className="text-gray-300">
                  • Using too much weight with poor form
                </Text>
                <Text className="text-gray-300">
                  • Not engaging the core muscles
                </Text>
              </View>
              
              <View>
                <Text className="text-white font-bold mb-2">🎯 Progression:</Text>
                <Text className="text-gray-300">
                  • Start with proper form before increasing intensity
                </Text>
                <Text className="text-gray-300">
                  • Gradually increase weight/reps over time
                </Text>
                <Text className="text-gray-300">
                  • Record your progress to track improvements
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add to Workout Button */}
      <View className="px-4 pb-4 pt-2 bg-gray-900 border-t border-gray-800">
        <TouchableOpacity className="bg-blue-600 py-4 rounded-lg">
          <Text className="text-white text-center font-bold text-lg">
            Add to Workout Plan
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}