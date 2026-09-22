import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  visible: boolean;
  onHidden?: () => void;
  children: ReactNode;
};

const FADE_MS = 240;

export function CameraFocusHud({ visible, onHidden, children }: Props) {
  const opacity = useSharedValue(visible ? 1 : 0);
  const visibleRef = useRef(visible);
  const onHiddenRef = useRef(onHidden);
  visibleRef.current = visible;
  onHiddenRef.current = onHidden;

  useEffect(() => {
    const notifyHidden = () => {
      if (!visibleRef.current) {
        onHiddenRef.current?.();
      }
    };

    opacity.value = withTiming(visible ? 1 : 0, { duration: FADE_MS }, (finished) => {
      if (finished && !visible) {
        runOnJS(notifyHidden)();
      }
    });
  }, [opacity, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.hud, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hud: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
});
