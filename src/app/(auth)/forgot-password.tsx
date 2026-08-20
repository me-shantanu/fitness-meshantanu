import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, useWindowDimensions, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import LottieView from 'lottie-react-native';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { showAlert } from '@/utils/alert';
import { useThemeStore } from '@/store/useThemeStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const { colors } = useThemeStore();
  const { width } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const lottieSize = isMobile ? Math.min(width * 0.7, 250) : isTablet ? 300 : 350;

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      showAlert('Error', 'Please enter your email address');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    const { error } = await resetPassword(trimmedEmail);

    setLoading(false);

    if (error) {
      showAlert('Error', error.message || 'Failed to send reset email. Please try again.');
    } else {
      setSent(true);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <LoadingOverlay visible={loading} message="Sending reset link..." />

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
                Forgot Password
              </Text>
              <Text className={`text-text-light mb-8 ${isMobile ? 'text-base text-center' : isTablet ? 'text-center text-lg' : 'text-lg'}`}>
                Enter your email and we'll send you a reset link
              </Text>

              {sent ? (
                <View className="bg-surface rounded-2xl border border-border p-4 mb-6">
                  <Text className={`text-text text-center ${isMobile ? 'text-sm' : 'text-base'}`}>
                    If an account exists for this email, a reset link has been sent.
                  </Text>
                </View>
              ) : (
                <>
                  <View className="mb-6">
                    <Text className={`text-text mb-1.5 font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                      Email
                    </Text>
                    <TextInput
                      className={`bg-surface-2 border border-border outline-none text-text px-4 ${isMobile ? 'py-1.5' : 'py-2.5'} rounded-md ${isMobile ? 'text-sm' : 'text-base'}`}
                      placeholder="your@email.com"
                      placeholderTextColor={colors.textLight}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!loading}
                      accessibilityLabel="Email"
                    />
                  </View>

                  <View className='flex-row justify-center items-center'>
                    <TouchableOpacity
                      className={`bg-primary py-1.5 px-3 mb-4 w-full rounded-full ${loading ? 'opacity-70' : ''}`}
                      onPress={handleResetPassword}
                      disabled={loading}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                    >
                      <Text className={`text-on-brand text-center font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                        Send Reset Link
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View className="flex-row justify-center items-center">
                <Text className={`text-text-light ${isMobile ? 'text-sm' : 'text-base'}`}>
                  Remember your password?{' '}
                </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity disabled={loading} accessibilityRole="button">
                    <Text className={`text-primary font-bold ${isMobile ? 'text-sm' : 'text-base'}`}>
                      Back to Login
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
