import { BlurView } from 'expo-blur';
import { memo, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const BLUR_INTENSITY = 100;
const TRANSITION_DURATION = 520;
const OPEN_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export const BLUR_FORM_CONTENT_PADDING = 20;

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  title: string;
  actionLabel: string;
  onClose: () => void;
  onAction: () => void;
  actionDisabled?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  hideHeaderActions?: boolean;
  /**
   * Keep blur at full intensity and fade the overlay in.
   * Use when children include images, which otherwise hitch a live intensity animation.
   */
  freezeBlurOnOpen?: boolean;
  children: ReactNode;
};

export function BlurFormOverlay({
  visible,
  blurTargetRef,
  title,
  actionLabel,
  onClose,
  onAction,
  actionDisabled = false,
  isSubmitting = false,
  error,
  hideHeaderActions = false,
  freezeBlurOnOpen = false,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const wasVisibleRef = useRef(false);
  const progress = useSharedValue(0);
  const isOpen = useSharedValue(0);
  const freezeOpen = useSharedValue(freezeBlurOnOpen ? 1 : 0);
  const [isPresent, setIsPresent] = useState(false);

  useLayoutEffect(() => {
    freezeOpen.value = freezeBlurOnOpen ? 1 : 0;

    if (visible) {
      setIsPresent(true);
      cancelAnimation(progress);
      isOpen.value = 1;
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: TRANSITION_DURATION,
        easing: OPEN_EASING,
      });
      wasVisibleRef.current = true;
      return;
    }

    if (!wasVisibleRef.current) return;

    wasVisibleRef.current = false;
    Keyboard.dismiss();
    cancelAnimation(progress);
    isOpen.value = 0;

    progress.value = withTiming(
      0,
      {
        duration: TRANSITION_DURATION,
        easing: CLOSE_EASING,
      },
      (finished) => {
        if (finished) {
          runOnJS(setIsPresent)(false);
        }
      }
    );
  }, [visible, freezeBlurOnOpen, freezeOpen, isOpen, progress]);

  const revealStyle = useAnimatedStyle(() => {
    if (freezeOpen.value && isOpen.value) {
      return { opacity: progress.value };
    }
    return { opacity: 1 };
  });

  if (!isPresent) return null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.revealLayer, revealStyle]} pointerEvents="box-none">
        <OverlayBlurBackdrop
          blurTargetRef={blurTargetRef}
          progress={progress}
          isOpen={isOpen}
          freezeOpen={freezeOpen}
        />

        {visible ? (
          <Pressable style={styles.dismissArea} onPress={onClose}>
            <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
              <Pressable onPress={(event) => event.stopPropagation()}>
                {hideHeaderActions ? (
                  <Text style={styles.headerTitleStandalone}>{title}</Text>
                ) : (
                  <View style={styles.header}>
                    <View style={styles.headerSide}>
                      <Pressable onPress={onClose} disabled={isSubmitting} hitSlop={8}>
                        <Text style={styles.cancelText}>Cancel</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={[styles.headerSide, styles.headerSideEnd]}>
                      <Pressable
                        onPress={onAction}
                        disabled={isSubmitting || actionDisabled}
                        hitSlop={8}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <Text
                            style={[styles.actionText, actionDisabled && styles.actionTextDisabled]}
                          >
                            {actionLabel}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}

                {children}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </Pressable>
            </View>
          </Pressable>
        ) : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const OverlayBlurBackdrop = memo(function OverlayBlurBackdrop({
  blurTargetRef,
  progress,
  isOpen,
  freezeOpen,
}: {
  blurTargetRef: RefObject<RNView | null>;
  progress: SharedValue<number>;
  isOpen: SharedValue<number>;
  freezeOpen: SharedValue<number>;
}) {
  const blurAnimatedProps = useAnimatedProps(() => {
    const intensity =
      freezeOpen.value && isOpen.value ? BLUR_INTENSITY : progress.value * BLUR_INTENSITY;

    return { intensity };
  });

  return (
    <AnimatedBlurView
      blurTarget={blurTargetRef}
      animatedProps={blurAnimatedProps}
      style={StyleSheet.absoluteFill}
      intensity={0}
      tint="systemThinMaterialLight"
      blurReductionFactor={1}
      blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
    />
  );
});

export const blurFormFieldStyles = StyleSheet.create({
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 38,
    textAlign: 'left',
    color: '#111',
  },
  codeInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 38,
    textAlign: 'left',
    color: '#111',
  },
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  revealLayer: {
    ...StyleSheet.absoluteFill,
  },
  dismissArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: BLUR_FORM_CONTENT_PADDING,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSide: {
    flex: 1,
    justifyContent: 'center',
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
  },
  headerTitleStandalone: {
    fontSize: 32,
    fontWeight: '600',
    color: '#111',
    marginBottom: 20,
  },
  error: {
    color: '#ff3b30',
    fontSize: 14,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 17,
    color: 'rgba(60, 60, 67, 0.72)',
  },
  actionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  actionTextDisabled: {
    opacity: 0.4,
  },
});
