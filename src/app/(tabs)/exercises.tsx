import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { exerciseService } from '../../services/exerciseService';
import { useExerciseStore } from '../../store/exerciseStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeStore } from '@/store/useThemeStore';

type ExerciseType = 'workout' | 'warmup' | 'cooldown';

export default function ExercisesScreen() {
  const router = useRouter();
  const { favorites, loadFavorites, addFavorite, removeFavorite, isFavorite } = useExerciseStore();
  
  const [activeTab, setActiveTab] = useState<ExerciseType>('workout');
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter states
  const [categories, setCategories] = useState([]);
  const [muscles, setMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadInitialData();
    loadFavorites();
  }, []);

  useEffect(() => {
    loadExercisesByTab();
  }, [activeTab, selectedCategory, selectedMuscle, selectedEquipment]);

  useEffect(() => {
    filterExercises();
  }, [searchQuery, exercises]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [categoriesData, musclesData, equipmentData] = await Promise.all([
        exerciseService.getCategories(),
        exerciseService.getMuscles(),
        exerciseService.getEquipment(),
      ]);
      
      setCategories(categoriesData);
      setMuscles(musclesData);
      setEquipment(equipmentData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
    setLoading(false);
  };

  const loadExercisesByTab = async () => {
    setLoading(true);
    try {
      let exercisesData = [];
      
      switch (activeTab) {
        case 'warmup':
          exercisesData = await exerciseService.getWarmupExercises();
          break;
        case 'cooldown':
          exercisesData = await exerciseService.getCooldownExercises();
          break;
        case 'workout':
        default:
          const filters = {};
          if (selectedMuscle) filters.muscle = selectedMuscle;
          if (selectedCategory) filters.category = selectedCategory;
          exercisesData = await exerciseService.getWorkoutExercises(filters);
          break;
      }
      
      setExercises(exercisesData);
      setFilteredExercises(exercisesData);
    } catch (error) {
      console.error(`Error loading ${activeTab} exercises:`, error);
      setExercises([]);
      setFilteredExercises([]);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    exerciseService.clearCache();
    await loadExercisesByTab();
    setRefreshing(false);
  };

  const filterExercises = () => {
    if (!searchQuery.trim()) {
      setFilteredExercises(exercises);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = exercises.filter(ex => 
      ex.name.toLowerCase().includes(query) ||
      (ex.description && ex.description.toLowerCase().includes(query)) ||
      (ex.category && ex.category.toLowerCase().includes(query))
    );
    
    setFilteredExercises(filtered);
  };

  const toggleFavorite = async (exercise) => {
    if (isFavorite(exercise.id)) {
      await removeFavorite(exercise.id);
    } else {
      await addFavorite(exercise.id, exercise.name);
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedMuscle(null);
    setSelectedEquipment(null);
    setSearchQuery('');
    loadExercisesByTab();
  };

  const renderExercise = ({ item }) => (
    <TouchableOpacity
      className="bg-surface p-4 rounded-lg mb-3 mx-4"
      onPress={() => router.push({
        pathname: '/exercise-detail',
        params: { 
          id: item.id,
          type: activeTab
        }
      })}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-text font-bold text-lg mb-1">{item.name}</Text>
          
          {item.category && (
            <View className="flex-row items-center mb-1">
              <View className={`px-2 py-1 rounded mr-2 ${
                item.category === 'Warmup' ? 'bg-orange-500' :
                item.category === 'Cooldown' ? 'bg-blue-500' :
                'bg-gray-700'
              }`}>
                <Text className="text-text text-xs">{item.category}</Text>
              </View>
              
              {item.duration && (
                <View className="flex-row items-center">
                  <MaterialIcons name="timer" size={12} color="#9CA3AF" />
                  <Text className="text-text-light text-xs ml-1">{item.duration}</Text>
                </View>
              )}
            </View>
          )}
          
          {item.description && (
            <Text className="text-text-light text-sm" numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          {item.muscles && item.muscles.length > 0 && (
            <View className="flex-row flex-wrap mt-2">
              {item.muscles.slice(0, 2).map((muscle, index) => (
                <View key={index} className="bg-gray-700 px-2 py-1 rounded mr-1 mb-1">
                  <Text className="text-gray-300 text-xs">{muscle}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(item);
          }}
          className="p-2"
        >
          <AntDesign
            name={isFavorite(item.id) ? 'heart' : 'hearto'}
            size={24}
            color={isFavorite(item.id) ? '#EF4444' : '#9CA3AF'}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
    const { vars, mode } = useThemeStore();
  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={vars} key={mode} className="flex-1 bg-black/50 justify-end">
        <View className="bg-bg rounded-t-3xl p-6 max-h-3/4">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-2xl font-bold">Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <AntDesign name="close" size={24} color="var(--text)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Filter */}
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-3">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                    selectedCategory === null ? 'bg-blue-600' : 'bg-surface'
                  }`}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text className="text-text">All Categories</Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                      selectedCategory === category.id ? 'bg-blue-600' : 'bg-surface'
                    }`}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Text className="text-text">{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Muscle Filter */}
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-3">Target Muscle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                    selectedMuscle === null ? 'bg-blue-600' : 'bg-surface'
                  }`}
                  onPress={() => setSelectedMuscle(null)}
                >
                  <Text className="text-text">All Muscles</Text>
                </TouchableOpacity>
                {muscles.map((muscle) => (
                  <TouchableOpacity
                    key={muscle.id}
                    className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                      selectedMuscle === muscle.id ? 'bg-blue-600' : 'bg-surface'
                    }`}
                    onPress={() => setSelectedMuscle(muscle.id)}
                  >
                    <Text className="text-text">{muscle.name_en || muscle.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Equipment Filter */}
            {activeTab === 'workout' && (
              <View className="mb-6">
                <Text className="text-text text-lg font-bold mb-3">Equipment</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                      selectedEquipment === null ? 'bg-blue-600' : 'bg-surface'
                    }`}
                    onPress={() => setSelectedEquipment(null)}
                  >
                    <Text className="text-text">All Equipment</Text>
                  </TouchableOpacity>
                  {equipment.map((eq) => (
                    <TouchableOpacity
                      key={eq.id}
                      className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                        selectedEquipment === eq.id ? 'bg-blue-600' : 'bg-surface'
                      }`}
                      onPress={() => setSelectedEquipment(eq.id)}
                    >
                      <Text className="text-text">{eq.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View className="flex-row justify-between mt-4">
            <TouchableOpacity
              className="bg-surface flex-1 mr-2 py-4 rounded-lg"
              onPress={clearFilters}
            >
              <Text className="text-text text-center font-bold">Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-blue-600 flex-1 ml-2 py-4 rounded-lg"
              onPress={() => {
                setShowFilters(false);
                loadExercisesByTab();
              }}
            >
              <Text className="text-text text-center font-bold">Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTabs = () => (
    <View className="flex-row px-4 mb-4">
      <TouchableOpacity
        className={`flex-1 py-3 rounded-l-lg ${
          activeTab === 'workout' ? 'bg-blue-600' : 'bg-surface'
        }`}
        onPress={() => setActiveTab('workout')}
      >
        <Text className={`text-center font-medium ${
          activeTab === 'workout' ? 'text-text' : 'text-text-light'
        }`}>
          Workout
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        className={`flex-1 py-3 ${
          activeTab === 'warmup' ? 'bg-orange-600' : 'bg-surface'
        }`}
        onPress={() => setActiveTab('warmup')}
      >
        <Text className={`text-center font-medium ${
          activeTab === 'warmup' ? 'text-text' : 'text-text-light'
        }`}>
          Warmup
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        className={`flex-1 py-3 rounded-r-lg ${
          activeTab === 'cooldown' ? 'bg-blue-600' : 'bg-surface'
        }`}
        onPress={() => setActiveTab('cooldown')}
      >
        <Text className={`text-center font-medium ${
          activeTab === 'cooldown' ? 'text-text' : 'text-text-light'
        }`}>
          Cooldown
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveFilters = () => {
    const activeFilters = [];
    
    if (selectedCategory) {
      const category = categories.find(c => c.id === selectedCategory);
      if (category) {
        activeFilters.push(`Category: ${category.name}`);
      }
    }
    
    if (selectedMuscle) {
      const muscle = muscles.find(m => m.id === selectedMuscle);
      if (muscle) {
        activeFilters.push(`Muscle: ${muscle.name_en || muscle.name}`);
      }
    }
    
    if (selectedEquipment) {
      const eq = equipment.find(e => e.id === selectedEquipment);
      if (eq) {
        activeFilters.push(`Equipment: ${eq.name}`);
      }
    }
    
    if (activeFilters.length === 0) return null;
    
    return (
      <View className="px-4 mb-3">
        <Text className="text-text-light text-sm mb-2">Active filters:</Text>
        <View className="flex-row flex-wrap">
          {activeFilters.map((filter, index) => (
            <View key={index} className="bg-blue-600 px-3 py-1 rounded-full mr-2 mb-2">
              <Text className="text-text text-sm">{filter}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-text mt-4">Loading exercises...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-text text-3xl font-bold mb-4">Exercises</Text>
        
        {/* Search Bar */}
        <View className="flex-row items-center mb-3">
          <View className="flex-1 bg-surface flex-row items-center px-4 py-3 rounded-lg mr-2">
            <AntDesign name="search1" size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 text-text ml-3"
              placeholder={`Search ${activeTab} exercises...`}
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <AntDesign name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          {activeTab === 'workout' && (
            <TouchableOpacity 
              onPress={() => setShowFilters(true)}
              className="bg-surface p-3 rounded-lg"
            >
              <FontAwesome name="filter" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Active Filters */}
      {activeTab === 'workout' && renderActiveFilters()}

      {/* Exercise List */}
      <FlatList
        data={filteredExercises}
        renderItem={renderExercise}
        keyExtractor={(item) => `${activeTab}_${item.id}`}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        ListHeaderComponent={
          <View className="px-4 pb-2">
            <Text className="text-text-light text-sm">
              {filteredExercises.length} {activeTab} exercises found
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <AntDesign name="search1" size={48} color="#6B7280" />
            <Text className="text-text-light mt-4 text-center text-lg">
              No {activeTab} exercises found
            </Text>
            <Text className="text-gray-500 mt-2 text-center">
              {searchQuery ? 'Try different search terms' : 'Try changing filters'}
            </Text>
          </View>
        }
      />

      {/* Filter Modal */}
      {renderFilterModal()}
    </SafeAreaView>
  );
}