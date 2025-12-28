import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { exerciseService, Exercise, ExerciseFilters } from '../../services/exerciseService';
import { useExerciseStore } from '../../store/exerciseStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import { useThemeStore } from '@/store/useThemeStore';

type ExerciseType = 'workout' | 'warmup' | 'cooldown';

export default function ExercisesScreen() {
  const router = useRouter();
  const { favorites, loadFavorites, addFavorite, removeFavorite, isFavorite } = useExerciseStore();
  const { vars, mode } = useThemeStore();

  const [activeTab, setActiveTab] = useState<ExerciseType>('workout');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Filter states
  const [categories, setCategories] = useState<any[]>([]);
  const [muscles, setMuscles] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadInitialData();
    loadFavorites();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      loadExercisesByTab();
    }
  }, [activeTab, selectedCategory, selectedMuscle, selectedEquipment]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else if (activeTab === 'workout') {
        loadExercisesByTab();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

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
      let exercisesData: Exercise[] = [];

      switch (activeTab) {
        case 'warmup':
          exercisesData = await exerciseService.getWarmupExercises();
          break;
        case 'cooldown':
          exercisesData = await exerciseService.getCooldownExercises();
          break;
        case 'workout':
        default:
          const filters: ExerciseFilters = {};
          if (selectedMuscle) filters.muscle = selectedMuscle;
          if (selectedCategory) filters.category = selectedCategory;
          if (selectedEquipment) filters.equipment = selectedEquipment;
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadExercisesByTab();
      return;
    }

    setSearchLoading(true);
    try {
      let exercisesData: Exercise[] = [];

      if (activeTab === 'workout') {
        const filters: ExerciseFilters = {
          search: searchQuery,
        };
        if (selectedMuscle) filters.muscle = selectedMuscle;
        if (selectedCategory) filters.category = selectedCategory;
        if (selectedEquipment) filters.equipment = selectedEquipment;

        exercisesData = await exerciseService.searchExercises(searchQuery, filters);
      } else {
        const allExercises = activeTab === 'warmup'
          ? await exerciseService.getWarmupExercises()
          : await exerciseService.getCooldownExercises();

        const query = searchQuery.toLowerCase();
        exercisesData = allExercises.filter(ex =>
          ex.name.toLowerCase().includes(query) ||
          (ex.description && ex.description.toLowerCase().includes(query)) ||
          (ex.category && ex.category.toLowerCase().includes(query))
        );
      }

      setExercises(exercisesData);
      setFilteredExercises(exercisesData);
    } catch (error) {
      console.error('Error searching exercises:', error);
      setExercises([]);
      setFilteredExercises([]);
    }
    setSearchLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    exerciseService.clearCache();
    await loadExercisesByTab();
    setRefreshing(false);
  };

  const toggleFavorite = async (exercise: Exercise) => {
    if (isFavorite(exercise.id)) {
      await removeFavorite(exercise.id);
    } else {
      await addFavorite(exercise.id, exercise.name, activeTab);
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedMuscle(null);
    setSelectedEquipment(null);
    setSearchQuery('');
    loadExercisesByTab();
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    // Extract muscle names for display
    const muscleNames = item.muscles?.map(m =>
      typeof m === 'string' ? m : (m.name_en || m.name)
    ).filter(Boolean) || [];

    return (
      <TouchableOpacity
        className="bg-surface p-4 rounded-xl mb-3 mx-4"
        onPress={() => router.push({
          pathname: '/exercise-detail',
          params: {
            id: item.id,
            type: activeTab
          }
        })}
        activeOpacity={0.7}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text className="text-text font-bold text-lg mb-2">{item.name}</Text>

            <View className="flex-row items-center flex-wrap mb-2">
              {/* Category Badge */}
              {item.category && (
                <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 bg-text`}>
                  <Text className="text-bg text-xs font-bold">{item.category}</Text>
                </View>
              )}

              {/* Duration Badge */}
              {item.duration && (
                <View className="flex-row items-center bg-surface-light px-3 py-1.5 rounded-full mr-2 mb-2">
                  <MaterialIcons name="timer" size={14} color={vars['--text'] as string} />
                  <Text className="text-text text-xs font-medium ml-1">{item.duration}</Text>
                </View>
              )}

              {/* Difficulty Badge */}
              {item.difficulty && (
                <View className="bg-surface-light px-3 py-1.5 rounded-full mb-2">
                  <Text className="text-text text-xs font-medium">{item.difficulty}</Text>
                </View>
              )}
            </View>

            {/* Description */}
            {item.description && (
              <Text className="text-text-light text-sm leading-5 mb-2" numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {/* Muscles Tags */}
            {muscleNames.length > 0 && (
              <View className="flex-row flex-wrap mt-1">
                {muscleNames.slice(0, 3).map((muscle, index) => (
                  <View key={index} className="bg-text px-2.5 py-1 rounded-full mr-1.5 mb-1.5">
                    <Text className="text-bg text-xs font-medium">{muscle}</Text>
                  </View>
                ))}
                {muscleNames.length > 3 && (
                  <View className="bg-text px-2.5 py-1 rounded-full mb-1.5">
                    <Text className="text-bg text-xs font-medium">+{muscleNames.length - 3}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Equipment Tags */}
            {item.equipment && item.equipment.length > 0 && (
              <View className="flex-row flex-wrap mt-1">
                {item.equipment.slice(0, 2).map((eq, index) => (
                  <View key={index} className="flex-row items-center bg-surface px-2.5 py-1 rounded-full mr-1.5 mb-1.5">
                    <Feather name="tool" size={10} color={vars['--text-light'] as string} />
                    <Text className="text-text-light text-xs ml-1">{typeof eq === 'string' ? eq : eq.name}</Text>
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isFavorite(item.id) ?
              <AntDesign
                name={'heart'}
                size={24}
                color={'#EF4444'}
              /> :
              <FontAwesome name="heart-o" size={24} color={vars['--text-light'] as string} />
            }
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
            <TouchableOpacity onPress={() => setShowFilters(false)} className="p-2">
              <AntDesign name="close" size={24} color={vars['--text'] as string} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Filter */}
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-3">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedCategory === null ? 'bg-primary' : 'bg-surface'
                    }`}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text className={`font-medium ${selectedCategory === null ? 'text-white' : 'text-text'
                    }`}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedCategory === category.id ? 'bg-primary' : 'bg-surface'
                      }`}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Text className={`font-medium ${selectedCategory === category.id ? 'text-white' : 'text-text'
                      }`}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Muscle Filter */}
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-3">Target Muscle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedMuscle === null ? 'bg-primary' : 'bg-surface'
                    }`}
                  onPress={() => setSelectedMuscle(null)}
                >
                  <Text className={`font-medium ${selectedMuscle === null ? 'text-white' : 'text-text'
                    }`}>All Muscles</Text>
                </TouchableOpacity>
                {muscles.map((muscle) => (
                  <TouchableOpacity
                    key={muscle.id}
                    className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedMuscle === muscle.id ? 'bg-primary' : 'bg-surface'
                      }`}
                    onPress={() => setSelectedMuscle(muscle.id)}
                  >
                    <Text className={`font-medium ${selectedMuscle === muscle.id ? 'text-white' : 'text-text'
                      }`}>{muscle.name_en || muscle.name}</Text>
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
                    className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedEquipment === null ? 'bg-primary' : 'bg-surface'
                      }`}
                    onPress={() => setSelectedEquipment(null)}
                  >
                    <Text className={`font-medium ${selectedEquipment === null ? 'text-white' : 'text-text'
                      }`}>All Equipment</Text>
                  </TouchableOpacity>
                  {equipment.map((eq) => (
                    <TouchableOpacity
                      key={eq.id}
                      className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedEquipment === eq.id ? 'bg-primary' : 'bg-surface'
                        }`}
                      onPress={() => setSelectedEquipment(eq.id)}
                    >
                      <Text className={`font-medium ${selectedEquipment === eq.id ? 'text-white' : 'text-text'
                        }`}>{eq.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View className="flex-row justify-between mt-4 pt-4 border-t border-border">
            <TouchableOpacity
              className="bg-surface flex-1 mr-2 py-4 rounded-xl"
              onPress={clearFilters}
            >
              <Text className="text-text text-center font-bold">Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-primary flex-1 ml-2 py-4 rounded-xl"
              onPress={() => {
                setShowFilters(false);
                loadExercisesByTab();
              }}
            >
              <Text className="text-white text-center font-bold">Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTabs = () => (
    <View className="flex-row px-4 mb-4">
      <TouchableOpacity
        className={`flex-1 py-3.5  ${activeTab === 'workout'
          ? 'bg-brand'
          : 'bg-surface'
          }`}
        onPress={() => setActiveTab('workout')}
        activeOpacity={0.7}
      >
        <Text className={`text-center font-bold text-text`}>
          Workout
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 py-3.5  ${activeTab === 'warmup'
          ? 'bg-brand'
          : 'bg-surface'
          }`}
        onPress={() => setActiveTab('warmup')}
        activeOpacity={0.7}
      >
        <Text className={`text-center font-bold text-text`}>
          Warmup
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`flex-1 py-3.5  ${activeTab === 'cooldown'
          ? 'bg-brand'
          : 'bg-surface'
          }`}
        onPress={() => setActiveTab('cooldown')}
        activeOpacity={0.7}
      >
        <Text className={`text-center font-bold text-text`}>
          Cooldown
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveFilters = () => {
    const activeFilters: { label: string; onRemove: () => void }[] = [];

    if (selectedCategory) {
      const category = categories.find(c => c.id === selectedCategory);
      if (category) {
        activeFilters.push({ label: `Category: ${category.name}`, onRemove: () => setSelectedCategory(null) });
      }
    }

    if (selectedMuscle) {
      const muscle = muscles.find(m => m.id === selectedMuscle);
      if (muscle) {
        activeFilters.push({ label: `Muscle: ${muscle.name_en || muscle.name}`, onRemove: () => setSelectedMuscle(null) });
      }
    }

    if (selectedEquipment) {
      const eq = equipment.find(e => e.id === selectedEquipment);
      if (eq) {
        activeFilters.push({ label: `Equipment: ${eq.name}`, onRemove: () => setSelectedEquipment(null) });
      }
    }

    if (activeFilters.length === 0) return null;

    return (
      <View className="px-4 mb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-light text-sm">Active filters:</Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text className="text-primary text-sm font-medium">Clear all</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row flex-wrap">
          {activeFilters.map((filter, index) => (
            <TouchableOpacity
              key={index}
              onPress={filter.onRemove}
              className="bg-primary px-3 py-1.5 rounded-full mr-2 mb-2 flex-row items-center"
              activeOpacity={0.7}
            >
              <Text className="text-white text-sm font-medium mr-1">{filter.label}</Text>
              <AntDesign name="close" size={12} color="white" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={vars['--primary'] as string} />
          <Text className="text-text mt-4 font-medium">Loading exercises...</Text>
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
          <View className="flex-1 bg-surface flex-row items-center px-4 py-3 rounded-xl mr-2">
            <FontAwesome name="search" size={20} color={vars['--text-light'] as string}/>
            <TextInput
              className="flex-1 text-text ml-3 text-base"
              placeholder={`Search ${activeTab} exercises...`}
              placeholderTextColor={vars['--text-light'] as string}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
                <AntDesign name="close" size={20} color={vars['--text-light'] as string} />
              </TouchableOpacity>
            ) : null}
          </View>

          {activeTab === 'workout' && (
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              className="bg-surface p-3 rounded-xl"
              activeOpacity={0.7}
            >
              <FontAwesome name="filter" size={20} color={vars['--text-light'] as string} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Active Filters */}
      {activeTab === 'workout' && renderActiveFilters()}

      {/* Loading Indicator for Search */}
      {searchLoading && (
        <View className="py-2">
          <ActivityIndicator size="small" color={vars['--primary'] as string} />
        </View>
      )}

      {/* Exercise List */}
      <FlatList
        data={filteredExercises}
        renderItem={renderExercise}
        keyExtractor={(item) => `${activeTab}_${item.id}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={vars['--primary'] as string}
            colors={[vars['--primary'] as string]}
          />
        }
        ListHeaderComponent={
          <View className="px-4 pb-2">
            <Text className="text-text-light text-sm">
              {filteredExercises.length} {activeTab} exercise{filteredExercises.length !== 1 ? 's' : ''} found
              {searchQuery && ` for "${searchQuery}"`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20 px-4">
            <View className="bg-surface w-24 h-24 rounded-full items-center justify-center mb-4">
              {searchQuery ? (
                <AntDesign name="search" size={48} color={vars['--text-light'] as string} />
              ) : (
                <MaterialIcons name="fitness-center" size={48} color={vars['--text-light'] as string} />
              )}
            </View>
            <Text className="text-text mt-4 text-center text-lg font-bold">
              {searchQuery
                ? 'No exercises found'
                : 'No exercises available'}
            </Text>
            <Text className="text-text-light mt-2 text-center">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Try changing your filters or pull down to refresh'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Filter Modal */}
      {renderFilterModal()}
    </SafeAreaView>
  );
}