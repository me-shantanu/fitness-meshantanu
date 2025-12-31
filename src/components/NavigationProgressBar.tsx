import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface NavigationProgressBarProps {
  visible: boolean;
}

export const NavigationProgressBar: React.FC<NavigationProgressBarProps> = ({ visible }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    } else {
      progress.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!visible) return null;

  return (
    <View className="absolute top-0 left-0 right-0 h-1 bg-surface/30 z-50">
      <Animated.View 
        className="h-full bg-brand"
        style={animatedStyle}
      />
    </View>
  );
};