import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  x: number;
  y: number;
  value: number;
  active?: boolean;
};

const TRACK_HEIGHT = 112;
const TRACK_WIDTH = 2;
const HANDLE_SIZE = 28;
const FADE_MS = 180;

export function CameraExposureSlider({ x, y, value, active = false }: Props) {
  const clamped = Math.max(-1, Math.min(1, value));
  const handleOffset = ((1 - clamped) / 2) * (TRACK_HEIGHT - HANDLE_SIZE);
  const trackOpacity = useSharedValue(0);

  useEffect(() => {
    trackOpacity.value = withTiming(active ? 1 : 0, { duration: FADE_MS });
  }, [active, trackOpacity]);

  const trackStyle = useAnimatedStyle(() => ({
    opacity: trackOpacity.value,
  }));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          left: x + 42,
          top: y - TRACK_HEIGHT / 2,
        },
      ]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <View style={styles.trackLine} />
      </Animated.View>

      <View style={[styles.handle, { top: handleOffset }]}>
        <SymbolView
          name={{ ios: 'sun.max.fill', android: 'wb_sunny' }}
          size={16}
          tintColor="#f5d442"
          weight="semibold"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 4,
    width: HANDLE_SIZE,
    height: TRACK_HEIGHT,
    alignItems: 'center',
  },
  track: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLine: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
