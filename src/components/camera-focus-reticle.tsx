import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  x: number;
  y: number;
};

const SIZE = 72;

export function CameraFocusReticle({ x, y }: Props) {
  const scale = useSharedValue(1.2);
  const opacity = useSharedValue(0.95);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(0.92, { duration: 140 }),
      withTiming(1, { duration: 120 })
    );
    opacity.value = withTiming(1, { duration: 100 });
  }, [x, y, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.reticle,
        animatedStyle,
        {
          left: x - SIZE / 2,
          top: y - SIZE / 2,
          width: SIZE,
          height: SIZE,
        },
      ]}
    >
      <View style={styles.cornerTopLeft} />
      <View style={styles.cornerTopRight} />
      <View style={styles.cornerBottomLeft} />
      <View style={styles.cornerBottomRight} />
    </Animated.View>
  );
}

const corner = {
  position: 'absolute' as const,
  width: 16,
  height: 16,
  borderColor: '#f5d442',
};

const styles = StyleSheet.create({
  reticle: {
    position: 'absolute',
    zIndex: 3,
  },
  cornerTopLeft: {
    ...corner,
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerTopRight: {
    ...corner,
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  cornerBottomLeft: {
    ...corner,
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBottomRight: {
    ...corner,
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
});
