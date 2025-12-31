import React from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import LottieView from 'lottie-react-native';
import { useRouter } from 'expo-router';

interface EmailVerificationScreenProps {
  email: string;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ email }) => {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const lottieSize = isMobile ? Math.min(width * 0.7, 250) : isTablet ? 300 : 350;

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className={`bg-bg flex items-center justify-center w-full min-h-full ${isDesktop ? 'flex-row' : 'flex-col'}`}>
        <View className={`${isDesktop ? 'flex-1' : 'w-full'} items-center justify-center ${isMobile ? 'py-8' : 'py-12'}`}>
          <LottieView
            source={require('../../assets/email-verification.json')}
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
            <Text className={`${isMobile ? 'text-3xl text-center' : isTablet ? 'text-4xl text-center' : 'text-5xl'} font-bold text-text mb-4`}>
              Check Your Email
            </Text>
            
            <Text className={`text-text-light mb-2 ${isMobile ? 'text-base text-center' : isTablet ? 'text-center text-lg' : 'text-lg'}`}>
              We've sent a verification link to
            </Text>
            
            <Text className={`text-text font-semibold mb-8 ${isMobile ? 'text-base text-center' : isTablet ? 'text-center text-lg' : 'text-lg'}`}>
              {email}
            </Text>
            
            <View className="bg-surface rounded-lg p-4 mb-8">
              <Text className={`text-text-light text-center ${isMobile ? 'text-sm' : 'text-base'}`}>
                Please check your inbox and click the verification link to activate your account.
              </Text>
            </View>

            <TouchableOpacity
              className="bg-brand py-3 px-8 rounded-full w-full mb-4"
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.8}
            >
              <Text className={`text-white text-center font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>
                Go to Login
              </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center items-center">
              <Text className={`text-text-light ${isMobile ? 'text-sm' : 'text-base'}`}>
                Didn't receive the email?{' '}
              </Text>
              <TouchableOpacity
                onPress={() => {/* Handle resend logic */}}
                activeOpacity={0.8}
              >
                <Text className={`text-text font-bold ${isMobile ? 'text-sm' : 'text-base'}`}>
                  Resend
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};