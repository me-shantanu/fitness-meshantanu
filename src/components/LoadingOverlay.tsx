import React from 'react';
import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message = 'Loading...' }) => {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
      <View className="items-center">
        <LottieView
          source={require('../assets/loader.json')}
          autoPlay
          loop
          style={{ width: 150, height: 150 }}
        />
        <Text className="text-text text-lg font-medium">{message}</Text>
      </View>
    </View>
  );
};