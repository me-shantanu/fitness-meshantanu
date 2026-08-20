// src/store/authStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  height: number | null;
  weight: number | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  bmr: number | null;
  activity_level: string | null;
  goal: 'lose_weight' | 'gain_muscle' | 'maintain' | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ data: any; error: any }>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  
  // Initialize auth state
  initialize: async () => {
    try {
      // Skip on server-side rendering
      if (typeof window === 'undefined') {
        set({ loading: false });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        set({ user: session.user, profile, loading: false });
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false });
    }
  },
  
  // Sign up
  signUp: async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });
      
      if (error) throw error;
      
      // Wait a bit for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update profile with full name (in case trigger didn't populate it)
      if (data.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', data.user.id);
        
        if (updateError) {
          console.error('Error updating profile name:', updateError);
        }
      }
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  
  // Sign in
  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        set({ user: data.user, profile });
      }
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  
  // Send a password reset email
  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, profile: null });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },
  
  // Update profile
  updateProfile: async (updates: Partial<Profile>) => {
    try {
      const userId = get().user?.id;
      if (!userId) {
        throw new Error('No user logged in');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      set({ profile: data });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  
  // Refresh profile
  refreshProfile: async () => {
    try {
      const userId = get().user?.id;
      if (!userId) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      set({ profile });
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  },
}));