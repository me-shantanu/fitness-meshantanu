import React, { useState, useEffect, useRef } from 'react';
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
import { showAlert } from '@/utils/alert';
import AddToPlanSheet from '@/components/AddToPlanSheet';

type ExerciseType = 'workout' | 'warmup' | 'cooldown';
type ListState = 'loading' | 'error' | 'ready';

export default function ExercisesScreen() {
  const router = useRouter();
  const { favorites, loadFavorites, isFavorite } = useExerciseStore();
  const { vars, mode, colors } = useThemeStore();

  const [activeTab, setActiveTab] = useState<ExerciseType>('workout');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Filter states
  const [categories, setCategories] = useState<any[]>([]);
  const [muscles, setMuscles] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<number | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Quick add-to-plan target
  const [addTarget, setAddTarget] = useState<Exercise | null>(null);

  // Request-sequence counter: stale responses never win.
  const seqRef = useRef(0);
  // Current page of the workout browse list (for infinite scroll).
  const pageRef = useRef(0);

  useEffect(() => {
    loadFilterOptions();
    loadFavorites();
  }, []);

  const loadFilterOptions = async () => {
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
      console.error('Error loading filter options:', error);
    }
  };

  const getFilters = (): ExerciseFilters => {
    const filters: ExerciseFilters = {};
    if (selectedMuscle) filters.muscle = selectedMuscle;
    if (selectedCategory) filters.category = selectedCategory;
    if (selectedEquipment) filters.equipment = selectedEquipment;
    return filters;
  };

  // Single load effect: tab switches, filter changes, retry, and (debounced)
  // search all funnel through here. Only the list area below the header shows
  // the loading/error state, so the search bar never unmounts.
  useEffect(() => {
    const query = searchQuery.trim();
    const delay = query ? 400 : 0;
    const timer = setTimeout(() => {
      loadList(query);
    }, delay);
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery, selectedCategory, selectedMuscle, selectedEquipment, reloadKey]);

  const loadList = async (query: string) => {
    const seq = ++seqRef.current;
    setListState('loading');
    try {
      let data: Exercise[] = [];
      let more = false;

      if (activeTab === 'warmup' || activeTab === 'cooldown') {
        data = activeTab === 'warmup'
          ? await exerciseService.getWarmupExercises()
          : await exerciseService.getCooldownExercises();
        if (query) {
          const q = query.toLowerCase();
          data = data.filter(ex => ex.name.toLowerCase().includes(q));
        }
      } else if (query) {
        data = await exerciseService.searchExercisesServer(query);
      } else {
        const result = await exerciseService.getWorkoutExercisesPaged(0, getFilters());
        data = result.exercises;
        more = result.hasMore;
        pageRef.current = 0;
      }

      if (seq !== seqRef.current) return;
      setExercises(data);
      setHasMore(more);
      setListState('ready');
    } catch (error) {
      if (seq !== seqRef.current) return;
      console.error(`Error loading ${activeTab} exercises:`, error);
      setExercises([]);
      setHasMore(false);
      setListState('error');
    } finally {
      if (seq === seqRef.current) setRefreshing(false);
    }
  };

  // Infinite scroll: append the next page (workout browse list only).
  const loadMore = async () => {
    if (
      activeTab !== 'workout' ||
      searchQuery.trim() ||
      !hasMore ||
      loadingMore ||
      listState !== 'ready'
    ) {
      return;
    }

    const seq = seqRef.current;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const result = await exerciseService.getWorkoutExercisesPaged(nextPage, getFilters());
      if (seq !== seqRef.current) return;

      pageRef.current = nextPage;
      setExercises(prev => {
        const seen = new Set(prev.map(ex => String(ex.id)));
        return [...prev, ...result.exercises.filter(ex => !seen.has(String(ex.id)))];
      });
      setHasMore(result.hasMore);
    } catch (error) {
      if (seq === seqRef.current) {
        console.error('Error loading more exercises:', error);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    exerciseService.clearCache();
    setReloadKey(k => k + 1);
  };

  const retry = () => setReloadKey(k => k + 1);

  const toggleFavorite = async (exercise: Exercise) => {
    try {
      const result = await useExerciseStore.getState().toggleFavorite(
        exercise.id,
        exercise.name,
        activeTab
      );

      if (!result.success) {
        showAlert(`Failed to ${isFavorite(exercise.id) ? 'remove' : 'add'} favorite: ${result.error}`);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedMuscle(null);
    setSelectedEquipment(null);
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    const muscleNames = item.muscles?.map(m =>
      typeof m === 'string' ? m : (m.name_en || m.name)
    ).filter(Boolean) || [];

    const thumb = item.images && item.images.length > 0 ? item.images[0].image : null;

    return (
      <TouchableOpacity
        className="bg-surface p-4 rounded-2xl border border-border mb-3 mx-4"
        onPress={() => router.push({
          pathname: '/exercise-detail',
          params: {
            id: item.id,
            type: activeTab
          }
        })}
        activeOpacity={0.7}
      >
        <View className="flex-row items-start">
          {/* Thumbnail */}
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={{ width: 56, height: 56, borderRadius: 12 }}
              resizeMode="cover"
              className="bg-surface-2 mr-3"
            />
          ) : (
            <View
              className="bg-surface-2 mr-3 items-center justify-center"
              style={{ width: 56, height: 56, borderRadius: 12 }}
            >
              <MaterialIcons name="fitness-center" size={26} color={colors.textLight} />
            </View>
          )}

          <View className="flex-1 mr-2">
            <Text className="text-text font-bold text-lg mb-1">{item.name}</Text>

            <View className="flex-row items-center flex-wrap">
              {item.category && (
                <View className="px-2.5 py-1 rounded-full mr-2 mb-1 bg-text">
                  <Text className="text-bg text-xs font-bold">{item.category}</Text>
                </View>
              )}

              {item.duration && (
                <View className="flex-row items-center bg-surface-2 px-2.5 py-1 rounded-full mr-2 mb-1">
                  <MaterialIcons name="timer" size={12} color={colors.text} />
                  <Text className="text-text text-xs font-medium ml-1">{item.duration}</Text>
                </View>
              )}

              {item.difficulty && (
                <View className="bg-surface-2 px-2.5 py-1 rounded-full mb-1">
                  <Text className="text-text text-xs font-medium">{item.difficulty}</Text>
                </View>
              )}
            </View>

            {muscleNames.length > 0 && (
              <Text className="text-text-light text-xs mt-1" numberOfLines={1}>
                {muscleNames.slice(0, 3).join(' • ')}
                {muscleNames.length > 3 ? `  +${muscleNames.length - 3}` : ''}
              </Text>
            )}
          </View>

          <View className="flex-row items-center">
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
                  size={22}
                  color={colors.danger}
                /> :
                <FontAwesome name="heart-o" size={22} color={colors.textLight} />
              }
            </TouchableOpacity>

            {activeTab === 'workout' && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setAddTarget(item);
                }}
                className="p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="add-circle-outline" size={24} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
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
        <View className="bg-bg rounded-t-3xl p-6" style={{ maxHeight: '75%' }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-text text-2xl font-bold">Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)} className="p-2">
              <AntDesign name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Filter */}
            <View className="mb-6">
              <Text className="text-text text-lg font-bold mb-3">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedCategory === null ? 'bg-primary' : 'bg-surface-2 border border-border'
                    }`}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text className={`font-medium ${selectedCategory === null ? 'text-on-brand' : 'text-text-light'
                    }`}>All Categories</Text>
                </TouchableOpacity>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedCategory === category.id ? 'bg-primary' : 'bg-surface-2 border border-border'
                      }`}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Text className={`font-medium ${selectedCategory === category.id ? 'text-on-brand' : 'text-text-light'
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
                  className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedMuscle === null ? 'bg-primary' : 'bg-surface-2 border border-border'
                    }`}
                  onPress={() => setSelectedMuscle(null)}
                >
                  <Text className={`font-medium ${selectedMuscle === null ? 'text-on-brand' : 'text-text-light'
                    }`}>All Muscles</Text>
                </TouchableOpacity>
                {muscles.map((muscle) => (
                  <TouchableOpacity
                    key={muscle.id}
                    className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedMuscle === muscle.id ? 'bg-primary' : 'bg-surface-2 border border-border'
                      }`}
                    onPress={() => setSelectedMuscle(muscle.id)}
                  >
                    <Text className={`font-medium ${selectedMuscle === muscle.id ? 'text-on-brand' : 'text-text-light'
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
                    className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedEquipment === null ? 'bg-primary' : 'bg-surface-2 border border-border'
                      }`}
                    onPress={() => setSelectedEquipment(null)}
                  >
                    <Text className={`font-medium ${selectedEquipment === null ? 'text-on-brand' : 'text-text-light'
                      }`}>All Equipment</Text>
                  </TouchableOpacity>
                  {equipment.map((eq) => (
                    <TouchableOpacity
                      key={eq.id}
                      className={`px-4 py-2.5 rounded-full mr-2 mb-2 ${selectedEquipment === eq.id ? 'bg-primary' : 'bg-surface-2 border border-border'
                        }`}
                      onPress={() => setSelectedEquipment(eq.id)}
                    >
                      <Text className={`font-medium ${selectedEquipment === eq.id ? 'text-on-brand' : 'text-text-light'
                        }`}>{eq.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Filters apply on select; just offer a reset + done */}
          <View className="flex-row justify-between mt-4 pt-4 border-t border-border">
            <TouchableOpacity
              className="bg-surface-2 border border-border flex-1 mr-2 py-4 rounded-xl"
              onPress={clearFilters}
            >
              <Text className="text-text text-center font-bold">Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-primary flex-1 ml-2 py-4 rounded-xl"
              onPress={() => setShowFilters(false)}
            >
              <Text className="text-on-brand text-center font-bold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTabs = () => (
    <View className="flex-row px-4 mb-4">
      {(['workout', 'warmup', 'cooldown'] as ExerciseType[]).map((tab) => {
        const selected = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3.5 rounded-xl mx-1 ${selected
              ? 'bg-primary'
              : 'bg-surface-2 border border-border'
              }`}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text className={`text-center font-bold capitalize ${selected ? 'text-on-brand' : 'text-text-light'}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
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
              <Text className="text-on-brand text-sm font-medium mr-1">{filter.label}</Text>
              <AntDesign name="close" size={12} color={colors.onBrand} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderListArea = () => {
    if (listState === 'loading' && !refreshing) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.brand} />
          <Text className="text-text mt-4 font-medium">Loading exercises...</Text>
        </View>
      );
    }

    if (listState === 'error') {
      return (
        <View className="flex-1 justify-center items-center px-8">
          <View className="bg-surface w-24 h-24 rounded-full items-center justify-center mb-4">
            <Feather name="wifi-off" size={40} color={colors.textLight} />
          </View>
          <Text className="text-text text-center text-lg font-bold">
            Couldn't load exercises
          </Text>
          <Text className="text-text-light mt-2 text-center">
            Check your connection.
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-3 rounded-xl mt-6"
            onPress={retry}
            activeOpacity={0.7}
          >
            <Text className="text-on-brand font-bold">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={exercises}
        renderItem={renderExercise}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-6">
              <ActivityIndicator size="small" color={colors.brand} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20 px-4">
            <View className="bg-surface w-24 h-24 rounded-full items-center justify-center mb-4">
              {searchQuery ? (
                <AntDesign name="search" size={48} color={colors.textLight} />
              ) : (
                <MaterialIcons name="fitness-center" size={48} color={colors.textLight} />
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
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header — stays mounted no matter what the list below is doing */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-text text-3xl font-bold">Exercises</Text>

          {/* Favorites Button */}
          <TouchableOpacity
            onPress={() => router.push('/favorites')}
            className="bg-surface-2 border border-border px-4 py-2 rounded-xl flex-row items-center"
            activeOpacity={0.7}
          >
            <AntDesign name="heart" size={20} color={colors.danger} />
            {favorites.length > 0 && (
              <View className="bg-primary px-2 py-0.5 rounded-full ml-2">
                <Text className="text-on-brand text-xs font-bold">{favorites.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center mb-3">
          <View className="flex-1 bg-surface-2 border border-border flex-row items-center px-4 py-3 rounded-xl mr-2">
            <FontAwesome name="search" size={20} color={colors.textLight} />
            <TextInput
              className="flex-1 text-text ml-3 text-base"
              placeholder={`Search ${activeTab} exercises...`}
              placeholderTextColor={colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
                <AntDesign name="close" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ) : null}
          </View>

          {activeTab === 'workout' && (
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              className="bg-surface-2 border border-border p-3 rounded-xl"
              activeOpacity={0.7}
            >
              <FontAwesome name="filter" size={20} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Active Filters */}
      {activeTab === 'workout' && renderActiveFilters()}

      {/* List area: spinner / error / empty / list */}
      {renderListArea()}

      {renderFilterModal()}

      {/* Quick add-to-plan sheet */}
      <AddToPlanSheet
        visible={addTarget !== null}
        exercise={addTarget ? { id: addTarget.id, name: addTarget.name } : null}
        exerciseType="workout"
        onClose={() => setAddTarget(null)}
      />
    </SafeAreaView>
  );
}
