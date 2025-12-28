import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useExerciseStore } from '../store/exerciseStore';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeStore } from '@/store/useThemeStore';

type FilterType = 'all' | 'workout' | 'warmup' | 'cooldown';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, loadFavorites, removeFavorite, loading } = useExerciseStore();
  const { vars } = useThemeStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');

  useEffect(() => {
    loadFavorites();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavorites();
    setRefreshing(false);
  };

  const handleRemoveFavorite = (exerciseId: string, exerciseName: string) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${exerciseName}" from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFavorite(exerciseId);
            if (!result.success) {
              Alert.alert('Error', 'Failed to remove favorite. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleExercisePress = (exerciseId: string, exerciseType: string) => {
    router.push({
      pathname: '/exercise-detail',
      params: {
        id: exerciseId,
        type: exerciseType,
      },
    });
  };

  const filteredFavorites = filterType === 'all' 
    ? favorites 
    : favorites.filter(fav => fav.exercise_type === filterType);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'workout':
        return 'bg-blue-500';
      case 'warmup':
        return 'bg-orange-500';
      case 'cooldown':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'workout':
        return <MaterialIcons name="fitness-center" size={16} color="white" />;
      case 'warmup':
        return <Ionicons name="flame" size={16} color="white" />;
      case 'cooldown':
        return <Ionicons name="snow" size={16} color="white" />;
      default:
        return null;
    }
  };

  const renderFavorite = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="bg-surface p-4 rounded-xl mb-3 mx-4"
      onPress={() => handleExercisePress(item.exercise_id, item.exercise_type)}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center mb-2">
            <Text className="text-text font-bold text-lg flex-1">{item.exercise_name}</Text>
          </View>

          <View className="flex-row items-center">
            <View className={`${getTypeColor(item.exercise_type)} px-3 py-1.5 rounded-full flex-row items-center`}>
              {getTypeIcon(item.exercise_type)}
              <Text className="text-white text-xs font-bold ml-1 capitalize">
                {item.exercise_type}
              </Text>
            </View>

            <Text className="text-text-light text-xs ml-3">
              Added {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveFavorite(item.exercise_id, item.exercise_name);
          }}
          className="p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AntDesign name="heart" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View>
      {/* Stats Card */}
      <View className="mx-4 mb-4 bg-primary p-6 rounded-2xl">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-4xl font-bold">{favorites.length}</Text>
            <Text className="text-white/80 text-sm mt-1">Favorite Exercises</Text>
          </View>
          <View className="bg-white/20 w-16 h-16 rounded-full items-center justify-center">
            <AntDesign name="heart" size={32} color="white" />
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="px-4 mb-4">
        <Text className="text-text text-sm font-medium mb-3">Filter by type</Text>
        <View className="flex-row">
          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg mr-2 ${
              filterType === 'all' ? 'bg-primary' : 'bg-surface'
            }`}
            onPress={() => setFilterType('all')}
            activeOpacity={0.7}
          >
            <Text className={`text-center font-bold ${
              filterType === 'all' ? 'text-white' : 'text-text'
            }`}>
              All ({favorites.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg mx-1 ${
              filterType === 'workout' ? 'bg-blue-500' : 'bg-surface'
            }`}
            onPress={() => setFilterType('workout')}
            activeOpacity={0.7}
          >
            <Text className={`text-center font-bold ${
              filterType === 'workout' ? 'text-white' : 'text-text'
            }`}>
              Workout ({favorites.filter(f => f.exercise_type === 'workout').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg mx-1 ${
              filterType === 'warmup' ? 'bg-orange-500' : 'bg-surface'
            }`}
            onPress={() => setFilterType('warmup')}
            activeOpacity={0.7}
          >
            <Text className={`text-center font-bold ${
              filterType === 'warmup' ? 'text-white' : 'text-text'
            }`}>
              Warmup ({favorites.filter(f => f.exercise_type === 'warmup').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-3 rounded-lg ml-2 ${
              filterType === 'cooldown' ? 'bg-green-500' : 'bg-surface'
            }`}
            onPress={() => setFilterType('cooldown')}
            activeOpacity={0.7}
          >
            <Text className={`text-center font-bold ${
              filterType === 'cooldown' ? 'text-white' : 'text-text'
            }`}>
              Cooldown ({favorites.filter(f => f.exercise_type === 'cooldown').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {filteredFavorites.length > 0 && (
        <View className="px-4 pb-2">
          <Text className="text-text-light text-sm">
            {filteredFavorites.length} {filterType !== 'all' ? filterType : ''} exercise{filteredFavorites.length !== 1 ? 's' : ''} saved
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View className="flex-1 justify-center items-center py-20 px-4">
      <View className="bg-surface w-24 h-24 rounded-full items-center justify-center mb-4">
        <FontAwesome name="heart-o" size={48} color={vars['--text-light'] as string} />
      </View>
      <Text className="text-text mt-4 text-center text-lg font-bold">
        {filterType === 'all' 
          ? 'No Favorites Yet' 
          : `No ${filterType.charAt(0).toUpperCase() + filterType.slice(1)} Favorites`}
      </Text>
      <Text className="text-text-light mt-2 text-center mb-6">
        {filterType === 'all'
          ? 'Start adding exercises to your favorites by tapping the heart icon'
          : `Add some ${filterType} exercises to see them here`}
      </Text>
      <TouchableOpacity
        className="bg-primary px-8 py-4 rounded-xl"
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text className="text-white font-bold">Browse Exercises</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing && favorites.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={vars['--primary'] as string} />
          <Text className="text-text mt-4 font-medium">Loading favorites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AntDesign name="arrow-left" size={24} color={vars['--text'] as string} />
          </TouchableOpacity>
          <Text className="text-text text-3xl font-bold">My Favorites</Text>
        </View>
      </View>

      {/* Favorites List */}
      <FlatList
        data={filteredFavorites}
        renderItem={renderFavorite}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={vars['--primary'] as string}
            colors={[vars['--primary'] as string]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}