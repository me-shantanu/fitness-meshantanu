// store/workoutStore.ts
import { create } from 'zustand';
import { workoutService } from '../services/workoutService';
import {
  WorkoutPlan,
  WorkoutSession,
  PersonalRecord
} from '../types/workout';

interface WorkoutStore {
  activePlan: WorkoutPlan | null;
  templates: WorkoutPlan[];
  currentSession: WorkoutSession | null;
  workoutHistory: WorkoutSession[];
  personalRecords: PersonalRecord[];
  loading: boolean;
  
  // Actions
  loadActivePlan: (userId: string) => Promise<void>;
  loadTemplates: (userId: string) => Promise<void>;
  activateTemplate: (userId: string, templateId: string, startDate: string, endDate: string) => Promise<boolean>;
  deletePlan: (userId: string, planId: string) => Promise<boolean>;
  startSession: (userId: string, workoutDayId: string) => Promise<WorkoutSession | null>;
  completeSession: (sessionId: string, caloriesBurned: number, userId: string) => Promise<boolean>;
  loadWorkoutHistory: (userId: string, limit?: number) => Promise<void>;
  loadPersonalRecords: (userId: string) => Promise<void>;
  clear: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  activePlan: null,
  templates: [],
  currentSession: null,
  workoutHistory: [],
  personalRecords: [],
  loading: false,

  loadActivePlan: async (userId: string) => {
    try {
      set({ loading: true });
      const plan = await workoutService.getActiveWorkoutPlan(userId);
      set({ activePlan: plan, loading: false });
    } catch (error) {
      console.error('Error loading active plan:', error);
      set({ loading: false });
    }
  },

  loadTemplates: async (userId: string) => {
    try {
      const templates = await workoutService.getTemplates(userId);
      set({ templates });
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  },

  activateTemplate: async (
    userId: string,
    templateId: string,
    startDate: string,
    endDate: string
  ) => {
    try {
      set({ loading: true });
      const result = await workoutService.activateTemplate(
        userId,
        templateId,
        startDate,
        endDate
      );
      
      if (result.success) {
        // The RPC clones the template into a NEW active plan (result.planId);
        // loadActivePlan fetches the active plan, so it picks up the clone.
        await get().loadActivePlan(userId);
        await get().loadTemplates(userId); // Refresh templates list
        set({ loading: false });
        return true;
      }
      set({ loading: false });
      return false;
    } catch (error) {
      console.error('Error activating template:', error);
      set({ loading: false });
      return false;
    }
  },

  deletePlan: async (userId: string, planId: string) => {
    try {
      set({ loading: true });
      const success = await workoutService.deletePlan(userId, planId);
      if (success) {
        if (get().activePlan?.id === planId) {
          set({ activePlan: null });
        }
        set({
          templates: get().templates.filter(t => t.id !== planId),
          loading: false
        });
        return true;
      }
      set({ loading: false });
      return false;
    } catch (error) {
      console.error('Error deleting plan:', error);
      set({ loading: false });
      return false;
    }
  },

  startSession: async (userId: string, workoutDayId: string) => {
    try {
      const session = await workoutService.startWorkoutSession(userId, workoutDayId);
      if (session) {
        set({ currentSession: session });
      }
      return session;
    } catch (error) {
      console.error('Error starting session:', error);
      return null;
    }
  },

  completeSession: async (sessionId: string, caloriesBurned: number, userId: string) => {
    try {
      const session = await workoutService.completeWorkoutSession(
        userId,
        sessionId,
        caloriesBurned
      );
      
      if (session) {
        set({ currentSession: null });
        await get().loadWorkoutHistory(userId);
        await get().loadPersonalRecords(userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error completing session:', error);
      return false;
    }
  },

  loadWorkoutHistory: async (userId: string, limit = 30) => {
    try {
      const history = await workoutService.getWorkoutHistory(userId, limit);
      set({ workoutHistory: history });
    } catch (error) {
      console.error('Error loading history:', error);
    }
  },

  loadPersonalRecords: async (userId: string) => {
    try {
      const records = await workoutService.getPersonalRecords(userId);
      set({ personalRecords: records });
    } catch (error) {
      console.error('Error loading PRs:', error);
    }
  },

  clear: () => set({
    activePlan: null,
    templates: [],
    currentSession: null,
    workoutHistory: [],
    personalRecords: [],
    loading: false
  })
}));