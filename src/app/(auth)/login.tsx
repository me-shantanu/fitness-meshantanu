import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, useWindowDimensions, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import LottieView from 'lottie-react-native';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { NavigationProgressBar } from '../../components/NavigationProgressBar';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const { width } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const lottieSize = isMobile ? Math.min(width * 0.7, 250) : isTablet ? 300 : 350;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    setShowProgress(true);
    
    const { error } = await signIn(email, password);
    
    setLoading(false);
    setShowProgress(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <NavigationProgressBar visible={showProgress} />
      <LoadingOverlay visible={loading} message="Signing you in..." />
      
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className={`bg-bg flex items-center justify-center w-full min-h-full ${isDesktop ? 'flex-row' : 'flex-col'}`}>
          <View className={`${isDesktop ? 'flex-1' : 'w-full'} items-center justify-center ${isMobile ? 'py-8' : 'py-12'}`}>
            <LottieView
              source={require('../../assets/login.json')}
              autoPlay
              loop
              style={{
                width: lottieSize,
                height: lottieSize,
                maxWidth: '90%',
              }}
              resizeMode="contain"
            />
          </View>

          <View className={`${isDesktop ? 'flex-1' : 'w-full'} bg-bg ${isMobile ? 'px-6 pb-8' : isTablet ? 'px-12 pb-12' : 'px-16 py-12'} justify-center`}>
            <View className={`w-full max-w-xl mx-auto`}>
              <Text className={`${isMobile ? 'text-3xl text-center' : isTablet ? 'text-4xl text-center' : 'text-5xl'} font-bold text-text mb-2`}>
                Welcome To LiftLab
              </Text>
              <Text className={`text-text-light mb-8 ${isMobile ? 'text-base text-center' : isTablet ? 'text-center text-lg' : 'text-lg'}`}>
                A Smarter Virtual Fitness Platform
              </Text>

              <View className="mb-4">
                <Text className={`text-text mb-1.5 font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                  Email
                </Text>
                <TextInput
                  className={`bg-surface outline-none text-text px-4 ${isMobile ? 'py-1.5' : 'py-2.5'} rounded-md ${isMobile ? 'text-sm' : 'text-base'}`}
                  placeholder="your@email.com"
                  placeholderTextColor="#6B7280"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>
              
              <View className="mb-6">
                <Text className={`text-text mb-1.5 font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                  Password
                </Text>
                <TextInput
                  className={`bg-surface outline-none text-text px-4 ${isMobile ? 'py-1.5' : 'py-2.5'} rounded-md ${isMobile ? 'text-sm' : 'text-base'}`}
                  placeholder="••••••••"
                  placeholderTextColor="#6B7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              <View className='flex-row justify-center items-center'>
                <TouchableOpacity
                  className={`bg-brand py-1.5 px-3 mb-4 w-full rounded-full ${loading ? 'opacity-70' : ''}`}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text className={`text-white text-center font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                    Sign In
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-center items-center">
                <Text className={`text-text-light ${isMobile ? 'text-sm' : 'text-base'}`}>
                  Don't have an account?{' '}
                </Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity disabled={loading}>
                    <Text className={`text-text font-bold ${isMobile ? 'text-sm' : 'text-base'}`}>
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}