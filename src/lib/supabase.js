// src/lib/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example), then restart the dev server.'
  );
}

// Use localStorage for web, AsyncStorage for native
const storage = Platform.OS === 'web' 
  ? {
      getItem: (key) => {
        if (typeof window === 'undefined') return null;
        return Promise.resolve(window.localStorage.getItem(key));
      },
      setItem: (key, value) => {
        if (typeof window === 'undefined') return Promise.resolve();
        return Promise.resolve(window.localStorage.setItem(key, value));
      },
      removeItem: (key) => {
        if (typeof window === 'undefined') return Promise.resolve();
        return Promise.resolve(window.localStorage.removeItem(key));
      },
    }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
