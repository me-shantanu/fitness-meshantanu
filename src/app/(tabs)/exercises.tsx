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

const EXERCISES_PER_PAGE = 15;

export default function ExercisesScreen() {
  const router = useRouter();
  const { favorites, loadFavorites, addFavorite, removeFavorite, isFavorite } = useExerciseStore();
  const { vars, mode } = useThemeStore();

  const [activeTab, setActiveTab] = useState<ExerciseType>('workout');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [displayedExercises, setDisplayedExercises] = useState<Exercise[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // Filter states
  const [categories, setCategories] = useState<any[]>([]);
  const [muscles, setMuscles] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Calculate pagination values
  const totalPages = Math.ceil(allExercises.length / EXERCISES_PER_PAGE);
  const startIndex = (currentPage - 1) * EXERCISES_PER_PAGE;
  const endIndex = startIndex + EXERCISES_PER_PAGE;

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

  // Update displayed exercises when page changes
  useEffect(() => {
    updateDisplayedExercises();
  }, [allExercises, currentPage]);

  const updateDisplayedExercises = () => {
    setPageLoading(true);
    // Simulate server-side pagination delay for smooth transition
    setTimeout(() => {
      const paginated = allExercises.slice(startIndex, endIndex);
      setDisplayedExercises(paginated);
      setPageLoading(false);
    }, 300);
  };

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
    setCurrentPage(1);
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

      setAllExercises(exercisesData);
    } catch (error) {
      console.error(`Error loading ${activeTab} exercises:`, error);
      setAllExercises([]);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadExercisesByTab();
      return;
    }

    setSearchLoading(true);
    setCurrentPage(1);
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
        const allExercisesData = activeTab === 'warmup'
          ? await exerciseService.getWarmupExercises()
          : await exerciseService.getCooldownExercises();

        const query = searchQuery.toLowerCase();
        exercisesData = allExercisesData.filter(ex =>
          ex.name.toLowerCase().includes(query) ||
          (ex.description && ex.description.toLowerCase().includes(query)) ||
          (ex.category && ex.category.toLowerCase().includes(query))
        );
      }

      setAllExercises(exercisesData);
    } catch (error) {
      console.error('Error searching exercises:', error);
      setAllExercises([]);
    }
    setSearchLoading(false);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    exerciseService.clearCache();
    await loadExercisesByTab();
    setRefreshing(false);
  };

  const toggleFavorite = async (exercise: Exercise) => {
    try {
      if (isFavorite(exercise.id)) {
        const result = await removeFavorite(exercise.id);
        if (!result.success) {
          console.error('Failed to remove favorite');
        }
      } else {
        const result = await addFavorite(exercise.id, exercise.name, activeTab);
        if (!result.success) {
          console.error('Failed to add favorite');
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedMuscle(null);
    setSelectedEquipment(null);
    setSearchQuery('');
    setCurrentPage(1);
    loadExercisesByTab();
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
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
              {item.category && (
                <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 bg-text`}>
                  <Text className="text-bg text-xs font-bold">{item.category}</Text>
                </View>
              )}

              {item.duration && (
                <View className="flex-row items-center bg-surface-light px-3 py-1.5 rounded-full mr-2 mb-2">
                  <MaterialIcons name="timer" size={14} color={vars['--text'] as string} />
                  <Text className="text-text text-xs font-medium ml-1">{item.duration}</Text>
                </View>
              )}

              {item.difficulty && (
                <View className="bg-surface-light px-3 py-1.5 rounded-full mb-2">
                  <Text className="text-text text-xs font-medium">{item.difficulty}</Text>
                </View>
              )}
            </View>

            {item.description && (
              <Text className="text-text-light text-sm leading-5 mb-2" numberOfLines={2}>
                {item.description}
              </Text>
            )}

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

  const renderPaginationControls = () => {
    if (allExercises.length === 0 || totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 5;

      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);

        if (currentPage > 3) {
          pages.push('...');
        }

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }

        if (currentPage < totalPages - 2) {
          pages.push('...');
        }

        pages.push(totalPages);
      }

      return pages;
    };

    return (
      <View className="px-4 py-6">
        {/* Info Banner */}
        <View className="bg-surface p-4 rounded-xl mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-text font-bold text-lg">
                Page {currentPage} of {totalPages}
              </Text>
              <Text className="text-text-light text-sm mt-1">
                Showing {startIndex + 1}-{Math.min(endIndex, allExercises.length)} of {allExercises.length} exercises
              </Text>
            </View>
            <View className="bg-primary px-4 py-2 rounded-full">
              <Text className="text-white font-bold">{allExercises.length}</Text>
            </View>
          </View>
        </View>

        {/* Navigation Controls */}
        <View className="flex-row items-center justify-between mb-4">
          {/* Previous Button */}
          <TouchableOpacity
            onPress={goToPreviousPage}
            disabled={currentPage === 1}
            className={`flex-row items-center px-6 py-3 rounded-xl ${currentPage === 1 ? 'bg-surface opacity-50' : 'bg-primary'
              }`}
            activeOpacity={0.7}
          >
            <AntDesign
              name="left"
              size={16}
              color={currentPage === 1 ? vars['--text-light'] as string : 'white'}
            />
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
          >
            <View className="flex-row w-fit items-center">
              {getPageNumbers().map((page, index) => {
                if (page === '...') {
                  return (
                    <View key={`ellipsis-${index}`} className="px-2">
                      <Text className="text-text-light font-bold">...</Text>
                    </View>
                  );
                }

                const isActive = page === currentPage;
                return (
                  <TouchableOpacity
                    key={page}
                    onPress={() => goToPage(page as number)}
                    className={`mx-1 w-12 h-12 rounded-xl items-center justify-center ${isActive ? 'bg-brand' : 'bg-surface'
                      }`}
                    activeOpacity={0.7}
                  >
                    <Text className={`font-bold ${isActive ? 'text-white' : 'text-text'
                      }`}>
                      {page}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <TouchableOpacity
            onPress={goToNextPage}
            disabled={currentPage === totalPages}
            className={`flex-row items-center px-6 py-3 rounded-xl ${currentPage === totalPages ? 'bg-surface opacity-50' : 'bg-primary'
              }`}
            activeOpacity={0.7}
          >
            <AntDesign
              name="right"
              size={16}
              color={currentPage === totalPages ? vars['--text-light'] as string : 'white'}
            />
          </TouchableOpacity>
        </View>
      </View>
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
            <FontAwesome name="search" size={20} color={vars['--text-light'] as string} />
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

      {/* Page Loading Overlay */}
      {pageLoading && (
        <View className="absolute top-0 left-0 right-0 bottom-0 bg-bg/80 justify-center items-center z-50">
          <View className="bg-surface p-6 rounded-2xl items-center">
            <ActivityIndicator size="large" color={vars['--primary'] as string} />
            <Text className="text-text mt-4 font-medium">Loading page {currentPage}...</Text>
          </View>
        </View>
      )}

      {/* Exercise List */}
      <FlatList
        data={displayedExercises}
        renderItem={renderExercise}
        keyExtractor={(item) => `${activeTab}_${item.id}_${currentPage}`}
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
              Showing {displayedExercises.length} exercises on this page
              {searchQuery && ` for "${searchQuery}"`}
            </Text>
          </View>
        }
        ListFooterComponent={renderPaginationControls}
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