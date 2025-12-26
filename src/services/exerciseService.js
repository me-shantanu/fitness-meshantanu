import axios from 'axios';

const WGER_API_BASE = 'https://wger.de/api/v2';

// Cache for exercises
let exerciseCache = null;
let exerciseInfoCache = {};

export const exerciseService = {
  // Get all exercises with pagination and language filter
  getAllExercises: async (limit = 200, offset = 0) => {
    try {
      const response = await axios.get(
        `${WGER_API_BASE}/exerciseinfo/?limit=${limit}&offset=${offset}&language=2`
      );
      
      const exercises = response.data.results
        .map(ex => {
          // Find English name from translations or use default
          const englishName = ex.name || 
            ex.translations?.find(t => t.language === 2)?.name ||
            ex.translations?.[0]?.name ||
            'Unnamed Exercise';
            
          const englishDescription = ex.description ||
            ex.translations?.find(t => t.language === 2)?.description ||
            ex.translations?.[0]?.description ||
            '';
          
          return {
            id: ex.id,
            uuid: ex.uuid,
            name: englishName,
            description: (englishDescription || '').replace(/<[^>]*>/g, ''),
            category: ex.category?.name || 'General',
            category_id: ex.category?.id,
            muscles: ex.muscles?.map(m => ({
              id: m.id,
              name: m.name,
              name_en: m.name_en,
              is_front: m.is_front
            })) || [],
            muscles_secondary: ex.muscles_secondary?.map(m => ({
              id: m.id,
              name: m.name,
              name_en: m.name_en,
              is_front: m.is_front
            })) || [],
            equipment: ex.equipment?.map(e => e.name) || [],
            images: ex.images?.map(img => img.image) || [],
            license: ex.license,
            license_author: ex.license_author,
            language: ex.language,
          };
        })
        .filter(ex => ex.name && ex.name !== 'Unnamed Exercise');
      
      return {
        exercises,
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
      };
    } catch (error) {
      console.error('Error fetching exercises:', error);
      return { exercises: [], count: 0 };
    }
  },

  // Get exercise by ID
  getExerciseById: async (id) => {
    try {
      if (exerciseInfoCache[id]) {
        return exerciseInfoCache[id];
      }

      const response = await axios.get(`${WGER_API_BASE}/exerciseinfo/${id}/?language=2`);
      const ex = response.data;
      
      const englishName = ex.name || 
        ex.translations?.find(t => t.language === 2)?.name ||
        ex.translations?.[0]?.name ||
        'Unnamed Exercise';
        
      const englishDescription = ex.description ||
        ex.translations?.find(t => t.language === 2)?.description ||
        ex.translations?.[0]?.description ||
        '';
      
      const exercise = {
        id: ex.id,
        uuid: ex.uuid,
        name: englishName,
        description: (englishDescription || '').replace(/<[^>]*>/g, ''),
        category: ex.category?.name || 'General',
        category_id: ex.category?.id,
        muscles: ex.muscles?.map(m => ({
          id: m.id,
          name: m.name,
          name_en: m.name_en,
          is_front: m.is_front
        })) || [],
        muscles_secondary: ex.muscles_secondary?.map(m => ({
          id: m.id,
          name: m.name,
          name_en: m.name_en,
          is_front: m.is_front
        })) || [],
        equipment: ex.equipment?.map(e => ({
          id: e.id,
          name: e.name
        })) || [],
        images: ex.images?.map(img => ({
          id: img.id,
          image: img.image,
          is_main: img.is_main
        })) || [],
        license: ex.license,
        license_author: ex.license_author,
        language: ex.language,
      };
      
      exerciseInfoCache[id] = exercise;
      return exercise;
    } catch (error) {
      console.error('Error fetching exercise:', error);
      return null;
    }
  },

  // Search exercises with filters
  searchExercises: async (query = '', filters = {}) => {
    try {
      let url = `${WGER_API_BASE}/exerciseinfo/?language=2&limit=100`;
      
      if (query) {
        url += `&name=${encodeURIComponent(query)}`;
      }
      
      if (filters.category) {
        url += `&category=${filters.category}`;
      }
      
      if (filters.muscle) {
        url += `&muscles=${filters.muscle}`;
      }
      
      if (filters.equipment) {
        url += `&equipment=${filters.equipment}`;
      }

      const response = await axios.get(url);
      
      return response.data.results.map(ex => ({
        id: ex.id,
        name: ex.name || ex.translations?.[0]?.name || 'Unnamed Exercise',
        description: (ex.description || '').replace(/<[^>]*>/g, ''),
        category: ex.category?.name || 'General',
        images: ex.images?.map(img => img.image) || [],
      }));
    } catch (error) {
      console.error('Error searching exercises:', error);
      return [];
    }
  },

  // Get categories from API (not just from exercises)
  getCategories: async () => {
    try {
      const response = await axios.get(`${WGER_API_BASE}/exercisecategory/`);
      return response.data.results.map(cat => ({
        id: cat.id,
        name: cat.name,
      }));
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  // Get muscles
  getMuscles: async () => {
    try {
      const response = await axios.get(`${WGER_API_BASE}/muscle/`);
      return response.data.results.map(muscle => ({
        id: muscle.id,
        name: muscle.name,
        name_en: muscle.name_en,
        is_front: muscle.is_front,
      }));
    } catch (error) {
      console.error('Error fetching muscles:', error);
      return [];
    }
  },

  // Get equipment
  getEquipment: async () => {
    try {
      const response = await axios.get(`${WGER_API_BASE}/equipment/`);
      return response.data.results.map(eq => ({
        id: eq.id,
        name: eq.name,
      }));
    } catch (error) {
      console.error('Error fetching equipment:', error);
      return [];
    }
  },

  // Get exercise images (fixed function)
  getExerciseImages: async (exerciseId) => {
    try {
      const response = await axios.get(`${WGER_API_BASE}/exerciseimage/?exercise=${exerciseId}`);
      return response.data.results.map(img => ({
        id: img.id,
        image: img.image,
        is_main: img.is_main,
        license: img.license,
        license_author: img.license_author,
      }));
    } catch (error) {
      console.error('Error fetching exercise images:', error);
      return [];
    }
  },

  // Get warmup exercises (custom category - you can define these)
  getWarmupExercises: async () => {
    const warmupExercises = [
      {
        id: 'warmup_1',
        name: 'Jumping Jacks',
        description: 'Full body warmup exercise to increase heart rate and warm up muscles',
        category: 'Warmup',
        duration: '60 seconds',
        type: 'cardio',
        video_url: 'https://www.youtube.com/watch?v=c4DAnQ6DtF8'
      },
      {
        id: 'warmup_2',
        name: 'Arm Circles',
        description: 'Rotate arms in circular motion to warm up shoulder joints',
        category: 'Warmup',
        duration: '30 seconds each direction',
        type: 'mobility',
        video_url: 'https://www.youtube.com/watch?v=BQr8PmWwkkk'
      },
      {
        id: 'warmup_3',
        name: 'Leg Swings',
        description: 'Forward and sideways leg swings to warm up hip joints',
        category: 'Warmup',
        duration: '15 reps each side',
        type: 'dynamic_stretch',
        video_url: 'https://www.youtube.com/watch?v=4cQO_ijIlcA'
      },
      {
        id: 'warmup_4',
        name: 'Cat-Cow Stretch',
        description: 'Spinal mobility exercise to warm up the back',
        category: 'Warmup',
        duration: '10 reps',
        type: 'yoga',
        video_url: 'https://www.youtube.com/watch?v=zF3p2dQL1J0'
      },
      {
        id: 'warmup_5',
        name: 'High Knees',
        description: 'Running in place bringing knees to chest height',
        category: 'Warmup',
        duration: '45 seconds',
        type: 'cardio',
        video_url: 'https://www.youtube.com/watch?v=Zb6N_8Q_EO8'
      }
    ];
    
    return warmupExercises;
  },

  // Get cooldown/stretching exercises
  getCooldownExercises: async () => {
    const cooldownExercises = [
      {
        id: 'cooldown_1',
        name: 'Hamstring Stretch',
        description: 'Seated hamstring stretch for flexibility and recovery',
        category: 'Cooldown',
        duration: '30 seconds each leg',
        type: 'static_stretch',
        video_url: 'https://www.youtube.com/watch?v=7wJ_3C2Hcbc'
      },
      {
        id: 'cooldown_2',
        name: 'Quad Stretch',
        description: 'Standing quadriceps stretch',
        category: 'Cooldown',
        duration: '30 seconds each leg',
        type: 'static_stretch',
        video_url: 'https://www.youtube.com/watch?v=2eS2hC-gt7I'
      },
      {
        id: 'cooldown_3',
        name: 'Child\'s Pose',
        description: 'Resting yoga pose to stretch the back and promote relaxation',
        category: 'Cooldown',
        duration: '60 seconds',
        type: 'yoga',
        video_url: 'https://www.youtube.com/watch?v=2MJGg-dUKh0'
      },
      {
        id: 'cooldown_4',
        name: 'Chest Opener Stretch',
        description: 'Doorway stretch for chest and shoulder muscles',
        category: 'Cooldown',
        duration: '30 seconds each side',
        type: 'static_stretch',
        video_url: 'https://www.youtube.com/watch?v=0dA6n4Qv_nY'
      },
      {
        id: 'cooldown_5',
        name: 'Deep Breathing',
        description: 'Controlled breathing exercise for relaxation and recovery',
        category: 'Cooldown',
        duration: '2 minutes',
        type: 'breathing',
        video_url: 'https://www.youtube.com/watch?v=SEfs5TJZ6Nk'
      }
    ];
    
    return cooldownExercises;
  },

  // Get workout exercises (from wger API with filtering)
  getWorkoutExercises: async (filters = {}) => {
    try {
      let url = `${WGER_API_BASE}/exerciseinfo/?language=2&limit=100`;
      
      if (filters.muscle) {
        url += `&muscles=${filters.muscle}`;
      }
      
      if (filters.category) {
        url += `&category=${filters.category}`;
      }
      
      const response = await axios.get(url);
      
      return response.data.results
        .map(ex => ({
          id: ex.id,
          name: ex.name || ex.translations?.[0]?.name || 'Unnamed Exercise',
          description: (ex.description || '').replace(/<[^>]*>/g, ''),
          category: ex.category?.name || 'General',
          muscles: ex.muscles?.map(m => m.name_en) || [],
          equipment: ex.equipment?.map(e => e.name) || [],
          images: ex.images?.map(img => img.image) || [],
        }))
        .filter(ex => ex.name !== 'Unnamed Exercise');
    } catch (error) {
      console.error('Error fetching workout exercises:', error);
      return [];
    }
  },

  clearCache: () => {
    exerciseCache = null;
    exerciseInfoCache = {};
  },
};