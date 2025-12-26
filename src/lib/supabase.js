// src/lib/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = 'https://ttoauublnprcdgvumrpj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0b2F1dWJsbnByY2RndnVtcnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTA0OTIsImV4cCI6MjA4MjI2NjQ5Mn0.v0CfzTkEGkfZQ6Ng4IFWe4Yyc2piPVNJfss0DiyrkE8';

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