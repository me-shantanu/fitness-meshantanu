import axios from 'axios';

const WGER_API_BASE = 'https://wger.de/api/v2';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

// Enhanced cache system with pagination support
let cache = {
  exercises: {},
  exerciseDetails: {},
  categories: { data: null, timestamp: null },
  muscles: { data: null, timestamp: null },
  equipment: { data: null, timestamp: null },
  videos: {},
  images: {},
  search: {},
};

const isCacheValid = (timestamp: number) => {
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_DURATION;
};

// Helper to clean HTML tags from descriptions
const cleanHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
};

// Types
export interface Exercise {
  id: number | string;
  uuid?: string;
  name: string;
  description: string;
  category: string;
  category_id?: number;
  muscles: Array<{ id: number; name: string; name_en: string; is_front: boolean } | string>;
  muscles_secondary: Array<{ id: number; name: string; name_en: string; is_front: boolean } | string>;
  equipment: Array<{ id: number; name: string } | string>;
  variations?: number[];
  license?: number;
  license_author?: string;
  images?: any[];
  videos?: any[];
  duration?: string;
  difficulty?: string;
  sets?: string;
  type?: string;
  calories?: string;
  benefits?: string[];
  video_url?: string;
}

export interface ExerciseResponse {
  exercises: Exercise[];
  count: number;
  next?: string;
  previous?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Muscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
}

export interface Equipment {
  id: number;
  name: string;
}

export interface ExerciseFilters {
  muscle?: number;
  category?: number;
  equipment?: number;
  search?: string;
}

export const exerciseService = {
  // Get all exercises with pagination
  getAllExercises: async (limit: number = 100, offset: number = 0): Promise<ExerciseResponse> => {
    try {
      const cacheKey = `exercises_${limit}_${offset}`;
      
      if (cache.exercises[cacheKey] && isCacheValid(cache.exercises[cacheKey].timestamp)) {
        return cache.exercises[cacheKey].data;
      }

      const response = await axios.get(
        `${WGER_API_BASE}/exerciseinfo/?limit=${limit}&offset=${offset}&language=2`
      );
      
      const exercises = response.data.results
        .map((ex: any) => {
          const englishName = ex.name || 
            ex.translations?.find((t: any) => t.language === 2)?.name ||
            'Unnamed Exercise';
            
          const englishDescription = ex.description ||
            ex.translations?.find((t: any) => t.language === 2)?.description ||
            '';
          
          return {
            id: ex.id,
            uuid: ex.uuid,
            name: englishName,
            description: cleanHtml(englishDescription),
            category: ex.category?.name || 'General',
            category_id: ex.category?.id,
            muscles: ex.muscles || [],
            muscles_secondary: ex.muscles_secondary || [],
            equipment: ex.equipment || [],
            variations: ex.variations || [],
            license: ex.license,
            license_author: ex.license_author,
            images: ex.images || [],
          };
        })
        .filter((ex: Exercise) => ex.name && ex.name !== 'Unnamed Exercise');
      
      const result = {
        exercises,
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
      };

      cache.exercises[cacheKey] = {
        data: result,
        timestamp: Date.now()
      };

      return result;
    } catch (error) {
      console.error('Error fetching exercises:', error);
      return { exercises: [], count: 0 };
    }
  },

  // Search exercises with improved logic
  searchExercises: async (query: string = '', filters: ExerciseFilters = {}): Promise<Exercise[]> => {
    try {
      const cacheKey = `search_${query}_${JSON.stringify(filters)}`;
      
      if (cache.search[cacheKey] && isCacheValid(cache.search[cacheKey].timestamp)) {
        return cache.search[cacheKey].data;
      }

      let exercises: Exercise[] = [];
      let url = `${WGER_API_BASE}/exerciseinfo/?language=2&limit=200`;
      let offset = 0;
      let hasMore = true;
      const searchTerm = query.toLowerCase();

      // Build base URL with filters
      if (filters.category) {
        url += `&category=${filters.category}`;
      }
      
      if (filters.muscle) {
        url += `&muscles=${filters.muscle}`;
      }
      
      if (filters.equipment) {
        url += `&equipment=${filters.equipment}`;
      }

      // Paginate through results
      while (hasMore && exercises.length < 500) {
        const response = await axios.get(`${url}&offset=${offset}`);
        const results = response.data.results;
        
        if (!results || results.length === 0) {
          hasMore = false;
          break;
        }

        const filteredResults = results
          .map((ex: any) => {
            const name = ex.name || ex.translations?.[0]?.name || 'Unnamed Exercise';
            const description = cleanHtml(ex.description || '');
            
            return {
              id: ex.id,
              uuid: ex.uuid,
              name,
              description,
              category: ex.category?.name || 'General',
              muscles: ex.muscles || [],
              equipment: ex.equipment || [],
              images: ex.images || [],
            };
          })
          .filter((ex: Exercise) => {
            if (ex.name === 'Unnamed Exercise') return false;
            
            if (searchTerm) {
              return ex.name.toLowerCase().includes(searchTerm) ||
                     ex.description.toLowerCase().includes(searchTerm) ||
                     ex.category.toLowerCase().includes(searchTerm);
            }
            
            return true;
          });

        exercises = [...exercises, ...filteredResults];
        
        if (!response.data.next) {
          hasMore = false;
        } else {
          offset += 200;
        }
      }

      // Additional search if needed
      if (searchTerm && exercises.length < 50) {
        const searchResponse = await axios.get(
          `${WGER_API_BASE}/exerciseinfo/?language=2&name=${encodeURIComponent(query)}&limit=200`
        );
        
        const searchResults = searchResponse.data.results
          .map((ex: any) => {
            const name = ex.name || ex.translations?.[0]?.name || 'Unnamed Exercise';
            const description = cleanHtml(ex.description || '');
            
            return {
              id: ex.id,
              uuid: ex.uuid,
              name,
              description,
              category: ex.category?.name || 'General',
              muscles: ex.muscles || [],
              equipment: ex.equipment || [],
              images: ex.images || [],
            };
          })
          .filter((ex: Exercise) => ex.name !== 'Unnamed Exercise');

        const exerciseMap = new Map();
        [...exercises, ...searchResults].forEach(ex => {
          if (!exerciseMap.has(ex.id)) {
            exerciseMap.set(ex.id, ex);
          }
        });
        
        exercises = Array.from(exerciseMap.values());
      }

      cache.search[cacheKey] = {
        data: exercises,
        timestamp: Date.now()
      };

      return exercises;
    } catch (error) {
      console.error('Error searching exercises:', error);
      return [];
    }
  },

  // Get workout exercises with enhanced search capabilities
  getWorkoutExercises: async (filters: ExerciseFilters = {}): Promise<Exercise[]> => {
    try {
      const cacheKey = `workout_${JSON.stringify(filters)}`;
      
      if (cache.exercises[cacheKey] && isCacheValid(cache.exercises[cacheKey].timestamp)) {
        return cache.exercises[cacheKey].data;
      }

      let exercises: Exercise[] = [];
      
      if (filters.search) {
        exercises = await exerciseService.searchExercises(filters.search, {
          muscle: filters.muscle,
          category: filters.category,
          equipment: filters.equipment,
        });
      } else {
        let url = `${WGER_API_BASE}/exerciseinfo/?language=2&limit=1500`;
        
        if (filters.muscle) {
          url += `&muscles=${filters.muscle}`;
        }
        
        if (filters.category) {
          url += `&category=${filters.category}`;
        }
        
        if (filters.equipment) {
          url += `&equipment=${filters.equipment}`;
        }
        
        const response = await axios.get(url);
        
        exercises = response.data.results
          .map((ex: any) => {
            const name = ex.name || ex.translations?.[0]?.name || 'Unnamed Exercise';
            const description = cleanHtml(ex.description || '');
            
            return {
              id: ex.id,
              uuid: ex.uuid,
              name,
              description,
              category: ex.category?.name || 'General',
              muscles: ex.muscles || [],
              muscles_secondary: ex.muscles_secondary || [],
              equipment: ex.equipment || [],
              images: ex.images || [],
            };
          })
          .filter((ex: Exercise) => ex.name !== 'Unnamed Exercise');
      }

      cache.exercises[cacheKey] = {
        data: exercises,
        timestamp: Date.now()
      };

      return exercises;
    } catch (error) {
      console.error('Error fetching workout exercises:', error);
      return [];
    }
  },

  // Get exercise by ID with full details
  getExerciseById: async (id: number | string): Promise<Exercise | null> => {
    try {
      if (typeof id === 'string' && (id.startsWith('warmup_') || id.startsWith('cooldown_'))) {
        const allExercises = id.startsWith('warmup_')
          ? await exerciseService.getWarmupExercises()
          : await exerciseService.getCooldownExercises();
        
        return allExercises.find((ex: Exercise) => ex.id === id) || null;
      }

      if (cache.exerciseDetails[id] && isCacheValid(cache.exerciseDetails[id].timestamp)) {
        return cache.exerciseDetails[id].data;
      }

      const response = await axios.get(`${WGER_API_BASE}/exerciseinfo/${id}/?language=2`);
      const ex = response.data;
      
      const englishName = ex.name || 
        ex.translations?.find((t: any) => t.language === 2)?.name ||
        'Unnamed Exercise';
        
      const englishDescription = ex.description ||
        ex.translations?.find((t: any) => t.language === 2)?.description ||
        '';
      
      const exercise: Exercise = {
        id: ex.id,
        uuid: ex.uuid,
        name: englishName,
        description: cleanHtml(englishDescription),
        category: ex.category?.name || 'General',
        category_id: ex.category?.id,
        muscles: ex.muscles || [],
        muscles_secondary: ex.muscles_secondary || [],
        equipment: ex.equipment || [],
        variations: ex.variations || [],
        images: ex.images || [],
        videos: ex.videos || [],
        license: ex.license,
        license_author: ex.license_author,
      };
      
      cache.exerciseDetails[id] = {
        data: exercise,
        timestamp: Date.now()
      };

      return exercise;
    } catch (error) {
      console.error('Error fetching exercise:', error);
      return null;
    }
  },

  // Get categories
  getCategories: async (): Promise<Category[]> => {
    try {
      if (cache.categories.data && isCacheValid(cache.categories.timestamp)) {
        return cache.categories.data;
      }

      const response = await axios.get(`${WGER_API_BASE}/exercisecategory/`);
      const categories = response.data.results.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
      }));

      cache.categories = {
        data: categories,
        timestamp: Date.now()
      };

      return categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  // Get muscles
  getMuscles: async (): Promise<Muscle[]> => {
    try {
      if (cache.muscles.data && isCacheValid(cache.muscles.timestamp)) {
        return cache.muscles.data;
      }

      const response = await axios.get(`${WGER_API_BASE}/muscle/`);
      const muscles = response.data.results.map((muscle: any) => ({
        id: muscle.id,
        name: muscle.name,
        name_en: muscle.name_en,
        is_front: muscle.is_front,
      }));

      cache.muscles = {
        data: muscles,
        timestamp: Date.now()
      };

      return muscles;
    } catch (error) {
      console.error('Error fetching muscles:', error);
      return [];
    }
  },

  // Get equipment
  getEquipment: async (): Promise<Equipment[]> => {
    try {
      if (cache.equipment.data && isCacheValid(cache.equipment.timestamp)) {
        return cache.equipment.data;
      }

      const response = await axios.get(`${WGER_API_BASE}/equipment/`);
      const equipment = response.data.results.map((eq: any) => ({
        id: eq.id,
        name: eq.name,
      }));

      cache.equipment = {
        data: equipment,
        timestamp: Date.now()
      };

      return equipment;
    } catch (error) {
      console.error('Error fetching equipment:', error);
      return [];
    }
  },

  // Get exercise images
  getExerciseImages: async (exerciseId: number | string): Promise<any[]> => {
    try {
      const cacheKey = `images_${exerciseId}`;
      
      if (cache.images[cacheKey] && isCacheValid(cache.images[cacheKey].timestamp)) {
        return cache.images[cacheKey].data;
      }

      const response = await axios.get(`${WGER_API_BASE}/exerciseimage/?exercise=${exerciseId}`);
      const images = response.data.results.map((img: any) => ({
        id: img.id,
        image: img.image,
        is_main: img.is_main,
        license: img.license,
        license_author: img.license_author,
      }));

      cache.images[cacheKey] = {
        data: images,
        timestamp: Date.now()
      };

      return images;
    } catch (error) {
      console.error('Error fetching exercise images:', error);
      return [];
    }
  },

  // Get exercise videos
  getExerciseVideos: async (exerciseId: number | string): Promise<any[]> => {
    try {
      const cacheKey = `videos_${exerciseId}`;
      
      if (cache.videos[cacheKey] && isCacheValid(cache.videos[cacheKey].timestamp)) {
        return cache.videos[cacheKey].data;
      }

      const response = await axios.get(`${WGER_API_BASE}/exercisevideo/?exercise=${exerciseId}`);
      const videos = response.data.results.map((vid: any) => ({
        id: vid.id,
        uuid: vid.uuid,
        exercise: vid.exercise,
        video: vid.video,
        is_main: vid.is_main,
        size: vid.size,
        duration: vid.duration,
        width: vid.width,
        height: vid.height,
        codec: vid.codec,
        codec_long: vid.codec_long,
        license: vid.license,
        license_author: vid.license_author,
      }));

      cache.videos[cacheKey] = {
        data: videos,
        timestamp: Date.now()
      };

      return videos;
    } catch (error) {
      console.error('Error fetching exercise videos:', error);
      return [];
    }
  },

  // Enhanced warmup exercises
  getWarmupExercises: async (): Promise<Exercise[]> => {
    const warmupExercises: Exercise[] = [
      {
        id: 'warmup_1',
        name: 'Jumping Jacks',
        description: 'A full-body warmup exercise that increases heart rate, improves blood circulation, and warms up all major muscle groups. Great for cardiovascular preparation.',
        category: 'Warmup',
        duration: '60 seconds',
        sets: '2-3 sets',
        type: 'cardio',
        difficulty: 'Beginner',
        calories: '8-10 per minute',
        video_url: 'https://www.youtube.com/watch?v=c4DAnQ6DtF8',
        benefits: ['Increases heart rate', 'Warms up entire body', 'Improves coordination'],
        muscles: ['Full Body', 'Cardiovascular'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_2',
        name: 'Arm Circles',
        description: 'Dynamic shoulder mobility exercise that loosens up the shoulder joints and surrounding muscles. Essential before upper body workouts.',
        category: 'Warmup',
        duration: '30 seconds each direction',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk',
        benefits: ['Improves shoulder mobility', 'Increases blood flow', 'Prevents injury'],
        muscles: ['Shoulders', 'Upper Back'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_3',
        name: 'Leg Swings',
        description: 'Dynamic stretching for hip flexors and hamstrings. Helps improve range of motion and prepares legs for intense activity.',
        category: 'Warmup',
        duration: '15 reps each side',
        sets: '2 sets',
        type: 'dynamic_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=4cQO_ijIlcA',
        benefits: ['Loosens hip joints', 'Improves flexibility', 'Warms up leg muscles'],
        muscles: ['Hip Flexors', 'Hamstrings', 'Glutes'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_4',
        name: 'Cat-Cow Stretch',
        description: 'Yoga-inspired spinal mobility exercise that improves flexibility in the spine and warms up the core muscles.',
        category: 'Warmup',
        duration: '10-15 reps',
        sets: '2 sets',
        type: 'yoga',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=zF3p2dQL1J0',
        benefits: ['Improves spinal flexibility', 'Warms up core', 'Reduces back tension'],
        muscles: ['Spine', 'Core', 'Back'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_5',
        name: 'High Knees',
        description: 'High-intensity cardio warmup that elevates heart rate quickly and activates the lower body muscles.',
        category: 'Warmup',
        duration: '45 seconds',
        sets: '2-3 sets',
        type: 'cardio',
        difficulty: 'Intermediate',
        calories: '10-12 per minute',
        video_url: 'https://www.youtube.com/watch?v=Zb6N_8Q_EO8',
        benefits: ['Rapid heart rate increase', 'Activates leg muscles', 'Improves coordination'],
        muscles: ['Quadriceps', 'Hip Flexors', 'Core'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_6',
        name: 'Butt Kicks',
        description: 'Dynamic warmup focusing on hamstrings and glutes while increasing cardiovascular activity.',
        category: 'Warmup',
        duration: '45 seconds',
        sets: '2-3 sets',
        type: 'cardio',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=Zb6N_8Q_EO8',
        benefits: ['Warms up hamstrings', 'Increases heart rate', 'Improves leg flexibility'],
        muscles: ['Hamstrings', 'Glutes', 'Calves'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_7',
        name: 'Torso Twists',
        description: 'Rotational movement to warm up the core, obliques, and lower back. Prepares the torso for twisting movements.',
        category: 'Warmup',
        duration: '20 reps',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk',
        benefits: ['Warms up core muscles', 'Improves spinal rotation', 'Activates obliques'],
        muscles: ['Obliques', 'Core', 'Lower Back'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_8',
        name: 'Walking Lunges',
        description: 'Dynamic lower body warmup that activates glutes, quads, and hamstrings while improving balance.',
        category: 'Warmup',
        duration: '10-12 reps each leg',
        sets: '2 sets',
        type: 'dynamic_stretch',
        difficulty: 'Intermediate',
        video_url: 'https://www.youtube.com/watch?v=4cQO_ijIlcA',
        benefits: ['Activates leg muscles', 'Improves balance', 'Warms up hip flexors'],
        muscles: ['Quadriceps', 'Glutes', 'Hamstrings'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_9',
        name: 'Shoulder Rolls',
        description: 'Gentle mobility exercise for shoulders and upper back. Perfect for desk workers before workouts.',
        category: 'Warmup',
        duration: '30 seconds',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk',
        benefits: ['Relieves shoulder tension', 'Improves posture', 'Warms up upper back'],
        muscles: ['Shoulders', 'Trapezius', 'Upper Back'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_10',
        name: 'Inchworms',
        description: 'Full-body dynamic stretch that warms up hamstrings, shoulders, and core while improving flexibility.',
        category: 'Warmup',
        duration: '8-10 reps',
        sets: '2 sets',
        type: 'dynamic_stretch',
        difficulty: 'Intermediate',
        video_url: 'https://www.youtube.com/watch?v=4cQO_ijIlcA',
        benefits: ['Full body warmup', 'Improves flexibility', 'Activates core'],
        muscles: ['Hamstrings', 'Shoulders', 'Core', 'Back'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_11',
        name: 'Hip Circles',
        description: 'Dynamic movement to lubricate hip joints and increase range of motion in all directions.',
        category: 'Warmup',
        duration: '30 seconds each direction',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=4cQO_ijIlcA',
        benefits: ['Improves hip mobility', 'Reduces stiffness', 'Warms up glutes'],
        muscles: ['Hips', 'Glutes', 'Lower Back'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_12',
        name: 'Ankle Circles',
        description: 'Important warmup for ankle joints, especially before running, jumping, or leg workouts.',
        category: 'Warmup',
        duration: '20 seconds each ankle',
        sets: '2 sets each direction',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=4cQO_ijIlcA',
        benefits: ['Improves ankle mobility', 'Prevents sprains', 'Warms up calves'],
        muscles: ['Ankles', 'Calves'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_13',
        name: 'Wrist Circles',
        description: 'Essential warmup for wrist joints before weightlifting or any hand-intensive exercise.',
        category: 'Warmup',
        duration: '20 seconds each direction',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk',
        benefits: ['Prevents wrist injuries', 'Improves grip strength', 'Increases flexibility'],
        muscles: ['Forearms', 'Wrists'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_14',
        name: 'Neck Tilts',
        description: 'Gentle neck mobility exercise to relieve tension and prevent neck strain.',
        category: 'Warmup',
        duration: '10 reps each direction',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk',
        benefits: ['Relieves neck tension', 'Improves posture', 'Prevents headaches'],
        muscles: ['Neck', 'Upper Trapezius'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'warmup_15',
        name: 'Jump Rope (Simulated)',
        description: 'Simulated jump rope motion without the rope. Excellent for cardio warmup and coordination.',
        category: 'Warmup',
        duration: '60 seconds',
        sets: '2-3 sets',
        type: 'cardio',
        difficulty: 'Intermediate',
        calories: '10-15 per minute',
        video_url: 'https://www.youtube.com/watch?v=Zb6N_8Q_EO8',
        benefits: ['Improves coordination', 'Great cardio warmup', 'Warms up calves'],
        muscles: ['Calves', 'Shoulders', 'Core'],
        equipment: ['None'],
        muscles_secondary: [],
      },
    ];
    
    return warmupExercises;
  },

  // Enhanced cooldown exercises
  getCooldownExercises: async (): Promise<Exercise[]> => {
    const cooldownExercises: Exercise[] = [
      {
        id: 'cooldown_1',
        name: 'Hamstring Stretch',
        description: 'Static stretch for hamstrings that improves flexibility and aids in muscle recovery after intense leg workouts.',
        category: 'Cooldown',
        duration: '30-45 seconds each leg',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=7wJ_3C2Hcbc',
        benefits: ['Improves flexibility', 'Reduces muscle soreness', 'Prevents injury'],
        muscles: ['Hamstrings', 'Lower Back'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_2',
        name: 'Quad Stretch',
        description: 'Standing stretch that targets quadriceps muscles, essential after running or leg exercises.',
        category: 'Cooldown',
        duration: '30-45 seconds each leg',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=2eS2hC-gt7I',
        benefits: ['Stretches quadriceps', 'Improves leg flexibility', 'Aids recovery'],
        muscles: ['Quadriceps', 'Hip Flexors'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_3',
        name: 'Child\'s Pose',
        description: 'Relaxing yoga pose that gently stretches the back, shoulders, and hips while promoting relaxation and stress relief.',
        category: 'Cooldown',
        duration: '60-90 seconds',
        sets: '2-3 sets',
        type: 'yoga',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=2MJGg-dUKh0',
        benefits: ['Stretches back and shoulders', 'Promotes relaxation', 'Reduces stress'],
        muscles: ['Back', 'Shoulders', 'Hips'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_4',
        name: 'Chest Opener Stretch',
        description: 'Doorway or partner-assisted stretch that opens up chest muscles and improves posture after upper body workouts.',
        category: 'Cooldown',
        duration: '30-45 seconds each side',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=0dA6n4Qv_nY',
        benefits: ['Opens chest muscles', 'Improves posture', 'Reduces shoulder tension'],
        muscles: ['Chest', 'Shoulders', 'Front Deltoids'],
        muscles_secondary: [],
        equipment: ['Doorway or Wall'],
      },
      {
        id: 'cooldown_5',
        name: 'Deep Breathing Exercise',
        description: 'Controlled breathing technique that promotes relaxation, reduces heart rate, and aids in recovery.',
        category: 'Cooldown',
        duration: '2-3 minutes',
        sets: '1 set',
        type: 'breathing',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=SEfs5TJZ6Nk',
        benefits: ['Lowers heart rate', 'Promotes recovery', 'Reduces stress'],
        muscles: ['Respiratory System', 'Core'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_6',
        name: 'Triceps Stretch',
        description: 'Overhead stretch targeting triceps and shoulders, perfect after upper body training.',
        category: 'Cooldown',
        duration: '30-45 seconds each arm',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=2eS2hC-gt7I',
        benefits: ['Stretches triceps', 'Improves shoulder flexibility', 'Reduces arm tension'],
        muscles: ['Triceps', 'Shoulders', 'Lats'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_7',
        name: 'Seated Spinal Twist',
        description: 'Gentle yoga twist that improves spinal mobility and stretches obliques and lower back.',
        category: 'Cooldown',
        duration: '30-45 seconds each side',
        sets: '2-3 sets',
        type: 'yoga',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=2MJGg-dUKh0',
        benefits: ['Improves spinal mobility', 'Stretches obliques', 'Aids digestion'],
        muscles: ['Obliques', 'Spine', 'Lower Back'],
        muscles_secondary: [],
        equipment: ['Yoga Mat'],
      },
      {
        id: 'cooldown_8',
        name: 'Hip Flexor Stretch',
        description: 'Kneeling lunge stretch that targets hip flexors, essential for runners and desk workers.',
        category: 'Cooldown',
        duration: '30-45 seconds each leg',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=7wJ_3C2Hcbc',
        benefits: ['Stretches hip flexors', 'Improves hip mobility', 'Reduces lower back pain'],
        muscles: ['Hip Flexors', 'Quadriceps', 'Psoas'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_9',
        name: 'Cat-Camel Stretch',
        description: 'Gentle spinal mobility exercise that promotes recovery and reduces back tension.',
        category: 'Cooldown',
        duration: '10-12 reps',
        sets: '2 sets',
        type: 'yoga',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=2MJGg-dUKh0',
        benefits: ['Improves spinal flexibility', 'Reduces back pain', 'Promotes relaxation'],
        muscles: ['Spine', 'Core', 'Back'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_10',
        name: 'Calf Stretch',
        description: 'Wall-assisted stretch for calf muscles, important after running or leg workouts.',
        category: 'Cooldown',
        duration: '30-45 seconds each leg',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=7wJ_3C2Hcbc',
        benefits: ['Stretches calf muscles', 'Prevents shin splints', 'Improves ankle mobility'],
        muscles: ['Calves', 'Achilles Tendon', 'Ankles'],
        equipment: ['Wall'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_11',
        name: 'Butterfly Stretch',
        description: 'Seated stretch that opens up hips and inner thighs, promoting flexibility and recovery.',
        category: 'Cooldown',
        duration: '45-60 seconds',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=7wJ_3C2Hcbc',
        benefits: ['Opens hip joints', 'Stretches inner thighs', 'Improves flexibility'],
        muscles: ['Adductors', 'Hip Joints', 'Groin'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_12',
        name: 'Neck Rolls',
        description: 'Gentle neck mobility exercise that relieves tension and promotes relaxation.',
        category: 'Cooldown',
        duration: '30 seconds each direction',
        sets: '2 sets',
        type: 'mobility',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk',
        benefits: ['Relieves neck tension', 'Improves neck mobility', 'Reduces headaches'],
        muscles: ['Neck', 'Trapezius', 'Upper Shoulders'],
        equipment: ['None'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_13',
        name: 'Downward Facing Dog',
        description: 'Yoga pose that stretches hamstrings, calves, shoulders, and back while promoting blood flow.',
        category: 'Cooldown',
        duration: '45-60 seconds',
        sets: '2-3 sets',
        type: 'yoga',
        difficulty: 'Intermediate',
        video_url: 'https://www.youtube.com/watch?v=2MJGg-dUKh0',
        benefits: ['Full body stretch', 'Improves circulation', 'Calms the mind'],
        muscles: ['Hamstrings', 'Calves', 'Shoulders', 'Back'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_14',
        name: 'Figure Four Stretch',
        description: 'Deep stretch for glutes and piriformis, excellent for relieving sciatica pain and tight hips.',
        category: 'Cooldown',
        duration: '30-45 seconds each side',
        sets: '2-3 sets',
        type: 'static_stretch',
        difficulty: 'Intermediate',
        video_url: 'https://www.youtube.com/watch?v=7wJ_3C2Hcbc',
        benefits: ['Relieves glute tension', 'Reduces sciatica pain', 'Improves hip mobility'],
        muscles: ['Glutes', 'Piriformis', 'Hips'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
      {
        id: 'cooldown_15',
        name: 'Supine Spinal Twist',
        description: 'Gentle lying twist that releases tension in the spine and improves digestion.',
        category: 'Cooldown',
        duration: '30-45 seconds each side',
        sets: '2-3 sets',
        type: 'yoga',
        difficulty: 'Beginner',
        video_url: 'https://www.youtube.com/watch?v=2MJGg-dUKh0',
        benefits: ['Releases spinal tension', 'Improves digestion', 'Calms nervous system'],
        muscles: ['Spine', 'Obliques', 'Lower Back'],
        equipment: ['Yoga Mat'],
        muscles_secondary: [],
      },
    ];
    
    return cooldownExercises;
  },

  // Clear all cache
  clearCache: () => {
    cache = {
      exercises: {},
      exerciseDetails: {},
      categories: { data: null, timestamp: null },
      muscles: { data: null, timestamp: null },
      equipment: { data: null, timestamp: null },
      videos: {},
      images: {},
      search: {},
    };
  },
};