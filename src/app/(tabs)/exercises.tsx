import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { exerciseService, Exercise, ExerciseFilters, PaginatedExerciseResponse } from '../../services/exerciseService';
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

  // 🚀 OPTIMIZED: Only store current page data
  const [displayedExercises, setDisplayedExercises] = useState<Exercise[]>([]);
  const [paginationInfo, setPaginationInfo] = useState<{
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrevious: boolean;
  }>({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasNext: false,
    hasPrevious: false,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // Filter states
  const [categories, setCategories] = useState([]);
  const [muscles, setMuscles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // 🚀 OPTIMIZED: Debounce reference
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data (categories, muscles, equipment) only once
  useEffect(() => {
    loadInitialData();
    loadFavorites();
  }, []);

  // 🚀 OPTIMIZED: Load exercises when tab or filters change
  useEffect(() => {
    loadExercises(1); // Reset to page 1 when filters change
  }, [activeTab, selectedCategory, selectedMuscle, selectedEquipment]);

  // 🚀 OPTIMIZED: Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadExercises(1); // Reset to page 1 when searching
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadInitialData = async () => {
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
  };

  // 🚀 OPTIMIZED: Server-side pagination
  const loadExercises = async (page: number = 1) => {
    // Don't show loading for page changes, only for initial load
    if (page === 1) {
      setLoading(true);
    } else {
      setPageLoading(true);
    }

    try {
      let result: PaginatedExerciseResponse;

      if (activeTab === 'warmup') {
        // For warmup/cooldown, we handle pagination client-side
        const allExercises = await exerciseService.getWarmupExercises();
        const filtered = searchQuery
          ? allExercises.filter(ex =>
            ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ex.description?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          : allExercises;

        const start = (page - 1) * EXERCISES_PER_PAGE;
        const end = start + EXERCISES_PER_PAGE;
        const paginated = filtered.slice(start, end);

        result = {
          exercises: paginated,
          count: filtered.length,
          totalPages: Math.ceil(filtered.length / EXERCISES_PER_PAGE),
          currentPage: page,
          hasNext: end < filtered.length,
          hasPrevious: page > 1,
        };
      } else if (activeTab === 'cooldown') {
        const allExercises = await exerciseService.getCooldownExercises();
        const filtered = searchQuery
          ? allExercises.filter(ex =>
            ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ex.description?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          : allExercises;

        const start = (page - 1) * EXERCISES_PER_PAGE;
        const end = start + EXERCISES_PER_PAGE;
        const paginated = filtered.slice(start, end);

        result = {
          exercises: paginated,
          count: filtered.length,
          totalPages: Math.ceil(filtered.length / EXERCISES_PER_PAGE),
          currentPage: page,
          hasNext: end < filtered.length,
          hasPrevious: page > 1,
        };
      } else {
        // 🚀 OPTIMIZED: Real server-side pagination for workout exercises
        const filters: ExerciseFilters = {
          muscle: selectedMuscle || undefined,
          category: selectedCategory || undefined,
          equipment: selectedEquipment || undefined,
          search: searchQuery.trim() || undefined,
        };

        result = await exerciseService.getWorkoutExercisesPaginated(
          filters,
          page,
          EXERCISES_PER_PAGE
        );
      }

      setDisplayedExercises(result.exercises);
      setPaginationInfo({
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.count,
        hasNext: result.hasNext,
        hasPrevious: result.hasPrevious,
      });
    } catch (error) {
      console.error('Error loading exercises:', error);
      setDisplayedExercises([]);
      setPaginationInfo({
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        hasNext: false,
        hasPrevious: false,
      });
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  // 🚀 OPTIMIZED: Simple page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= paginationInfo.totalPages && page !== paginationInfo.currentPage) {
      loadExercises(page);
    }
  };

  const goToNextPage = () => {
    if (paginationInfo.hasNext) {
      goToPage(paginationInfo.currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (paginationInfo.hasPrevious) {
      goToPage(paginationInfo.currentPage - 1);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    exerciseService.clearCache();
    await loadExercises(1);
    setRefreshing(false);
  };

  const toggleFavorite = async (exercise: Exercise) => {
    try {
      const result = await useExerciseStore.getState().toggleFavorite(
        exercise.id,
        exercise.name,
        activeTab
      );

      if (!result.success) {
        console.error('Failed to toggle favorite:', result.error);
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
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    const muscleNames = item.muscles?.map(m =>
      typeof m === 'string' ? m : (m.name_en || m.name)
    ).filter(Boolean) || [];

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/exercise-detail',
            params: { id: item.id, type: activeTab }
          })
        }
        activeOpacity={0.7}
        style={{
          backgroundColor: vars.surface,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: vars.text, marginBottom: 6 }}>
              {item.name}
            </Text>

            {item.category && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <MaterialIcons name="category" size={14} color={vars.textSecondary} />
                <Text style={{ fontSize: 12, color: vars.textSecondary, marginLeft: 4 }}>
                  {item.category}
                </Text>
              </View>
            )}

            {item.duration && (
              <View className="flex-row items-center bg-surface-light px-3 py-1.5 rounded-full mr-2 mb-2">
                <MaterialIcons name="timer" size={14} color={vars['--text'] as string} />
                <Text className="text-text text-xs font-medium ml-1">{item.duration}</Text>
              </View>
            )}

            {item.difficulty && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <MaterialIcons name="fitness-center" size={14} color={vars.textSecondary} />
                <Text style={{ fontSize: 12, color: vars.textSecondary, marginLeft: 4 }}>
                  {item.difficulty}
                </Text>
              </View>
            )}

            {item.description && (
              <Text
                numberOfLines={2}
                style={{ fontSize: 13, color: vars.textSecondary, marginTop: 6, lineHeight: 18 }}
              >
                {item.description}
              </Text>
            )}

            {muscleNames.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
                {muscleNames.slice(0, 3).map((muscle, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: vars.brand + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: vars.brand, fontWeight: '500' }}>
                      {muscle}
                    </Text>
                  </View>
                ))}
                {muscleNames.length > 3 && (
                  <View
                    style={{
                      backgroundColor: vars.surface,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: vars.border,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: vars.textSecondary }}>
                      +{muscleNames.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {item.equipment && item.equipment.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
                {item.equipment.slice(0, 2).map((eq, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: vars.background,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <FontAwesome name="cube" size={10} color={vars.textSecondary} />
                    <Text style={{ fontSize: 11, color: vars.textSecondary, marginLeft: 4 }}>
                      {typeof eq === 'string' ? eq : eq.name}
                    </Text>
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
            style={{ padding: 8 }}
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
    if (paginationInfo.totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const maxVisible = 5;
      const { currentPage, totalPages } = paginationInfo;

      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push('...');

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }

        if (currentPage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
      }

      return pages;
    };

    const startIndex = (paginationInfo.currentPage - 1) * EXERCISES_PER_PAGE;
    const endIndex = Math.min(startIndex + EXERCISES_PER_PAGE, paginationInfo.totalCount);

    return (
      <View style={{ marginTop: 16, marginBottom: 20 }}>
        {/* Info Banner */}
        <View
          style={{
            backgroundColor: vars.surface,
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: vars.textSecondary }}>
              Page {paginationInfo.currentPage} of {paginationInfo.totalPages}
            </Text>
            <Text style={{ fontSize: 13, color: vars.textSecondary }}>
              Showing {startIndex + 1}-{endIndex} of {paginationInfo.totalCount}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: vars.brand, fontWeight: '600' }}>
              {paginationInfo.totalCount} exercises
            </Text>
          </View>
        </View>

        {/* Navigation Controls */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Previous Button */}
          <TouchableOpacity
            onPress={goToPreviousPage}
            disabled={!paginationInfo.hasPrevious}
            style={{
              backgroundColor: paginationInfo.hasPrevious ? vars.brand : vars.surface,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              marginRight: 8,
              opacity: paginationInfo.hasPrevious ? 1 : 0.5,
            }}
            activeOpacity={0.7}
          >
            <AntDesign
              name="left"
              size={16}
              color={paginationInfo.hasPrevious ? '#FFFFFF' : vars.textSecondary}
            />
          </TouchableOpacity>

          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <View
                  key={`ellipsis-${index}`}
                  style={{
                    marginHorizontal: 4,
                    width: 48,
                    height: 48,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, color: vars.textSecondary }}>...</Text>
                </View>
              );
            }

            const isActive = page === paginationInfo.currentPage;

            return (
              <TouchableOpacity
                key={page}
                onPress={() => goToPage(page as number)}
                style={{
                  marginHorizontal: 4,
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: isActive ? vars.brand : vars.surface,
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? '600' : '400',
                    color: isActive ? '#FFFFFF' : vars.text,
                  }}
                >
                  {page}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Next Button */}
          <TouchableOpacity
            onPress={goToNextPage}
            disabled={!paginationInfo.hasNext}
            style={{
              backgroundColor: paginationInfo.hasNext ? vars.brand : vars.surface,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              marginLeft: 8,
              opacity: paginationInfo.hasNext ? 1 : 0.5,
            }}
            activeOpacity={0.7}
          >
            <AntDesign
              name="right"
              size={16}
              color={paginationInfo.hasNext ? '#FFFFFF' : vars.textSecondary}
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
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: vars.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: '80%',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', color: vars.text }}>
              Filters
            </Text>
            <TouchableOpacity
              onPress={() => setShowFilters(false)}
              style={{ padding: 8 }}
            >
              <AntDesign name="close" size={24} color={vars.text} />
            </TouchableOpacity>
          </View>

          {/* Filter content in ScrollView */}
          <View style={{ maxHeight: '70%' }}>
            {/* Category Filter */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: vars.text, marginBottom: 12 }}>
              Category
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={{
                backgroundColor: selectedCategory === null ? vars.brand : vars.surface,
                padding: 12,
                borderRadius: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: selectedCategory === null ? '#FFFFFF' : vars.text }}>
                All Categories
              </Text>
            </TouchableOpacity>
            {categories.map((category: any) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={{
                  backgroundColor: selectedCategory === category.id ? vars.brand : vars.surface,
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: selectedCategory === category.id ? '#FFFFFF' : vars.text }}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Similar sections for Muscle and Equipment */}
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              onPress={clearFilters}
              style={{
                flex: 1,
                backgroundColor: vars.surface,
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: vars.text, fontWeight: '600' }}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowFilters(false);
                loadExercises(1);
              }}
              style={{
                flex: 1,
                backgroundColor: vars.brand,
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: vars.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={vars.brand} />
        <Text style={{ color: vars.text, marginTop: 12 }}>Loading exercises...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: vars.background }}>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Your existing header, search, tabs, etc. */}

        {/* Loading Overlay for Page Changes */}
        {pageLoading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <View style={{ backgroundColor: vars.surface, padding: 24, borderRadius: 16, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={vars.brand} />
              <Text style={{ color: vars.text, marginTop: 12, fontSize: 16 }}>
                Loading page {paginationInfo.currentPage}...
              </Text>
            </View>
          </View>
        )}

        {/* Exercise List */}
        <FlatList
          data={displayedExercises}
          renderItem={renderExercise}
          keyExtractor={(item) => `${activeTab}_${item.id}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={vars.brand}
              colors={[vars.brand]}
            />
          }
          ListFooterComponent={renderPaginationControls}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 16, color: vars.textSecondary }}>
                No exercises found
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        {renderFilterModal()}
      </View>
    </SafeAreaView>
  );
}