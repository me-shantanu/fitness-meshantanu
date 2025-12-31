import React from 'react';
import { View, useWindowDimensions, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

interface ResponsiveLottieProps {
  source: any;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: ViewStyle;
  // Size presets for different use cases
  sizePreset?: 'small' | 'medium' | 'large' | 'full';
  // Custom size multipliers for each breakpoint
  mobileSizeMultiplier?: number;
  tabletSizeMultiplier?: number;
  desktopSizeMultiplier?: number;
  // Container styling
  containerClassName?: string;
}

export default function ResponsiveLottie({
  source,
  autoPlay = true,
  loop = true,
  speed = 1,
  style,
  sizePreset = 'medium',
  mobileSizeMultiplier = 0.7,
  tabletSizeMultiplier = 0.8,
  desktopSizeMultiplier = 1,
  containerClassName = '',
}: ResponsiveLottieProps) {
  const { width, height } = useWindowDimensions();

  // Responsive breakpoints
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  // Size presets based on screen type
  const getSizeFromPreset = (): number => {
    const baseSize = {
      small: isMobile ? 150 : isTablet ? 200 : 250,
      medium: isMobile ? 250 : isTablet ? 300 : 350,
      large: isMobile ? 350 : isTablet ? 450 : 550,
      full: Math.min(width * 0.9, height * 0.5),
    };

    return baseSize[sizePreset];
  };

  // Apply custom multipliers
  const getAdjustedSize = (): number => {
    const baseSize = getSizeFromPreset();
    
    if (isMobile) {
      return baseSize * mobileSizeMultiplier;
    } else if (isTablet) {
      return baseSize * tabletSizeMultiplier;
    } else {
      return baseSize * desktopSizeMultiplier;
    }
  };

  const lottieSize = getAdjustedSize();

  return (
    <View className={`items-center justify-center ${containerClassName}`}>
      <LottieView
        source={source}
        autoPlay={autoPlay}
        loop={loop}
        speed={speed}
        style={[
          {
            width: lottieSize,
            height: lottieSize,
            maxWidth: '100%',
            maxHeight: '100%',
          },
          style,
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

// Preset configurations for common use cases
export const LottiePresets = {
  hero: {
    sizePreset: 'large' as const,
    mobileSizeMultiplier: 0.8,
    tabletSizeMultiplier: 0.9,
    desktopSizeMultiplier: 1,
  },
  icon: {
    sizePreset: 'small' as const,
    mobileSizeMultiplier: 0.6,
    tabletSizeMultiplier: 0.7,
    desktopSizeMultiplier: 0.8,
  },
  feature: {
    sizePreset: 'medium' as const,
    mobileSizeMultiplier: 0.7,
    tabletSizeMultiplier: 0.85,
    desktopSizeMultiplier: 1,
  },
  loading: {
    sizePreset: 'small' as const,
    loop: true,
    autoPlay: true,
  },
};