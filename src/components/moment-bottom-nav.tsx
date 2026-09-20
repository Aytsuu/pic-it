import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavItem = {
  id: 'camera' | 'select' | 'search';
  label: string;
  iosSymbol: 'camera.fill' | 'checkmark.circle' | 'magnifyingglass';
  androidSymbol: 'photo_camera' | 'check_circle' | 'search';
  onPress: () => void;
  isActive?: boolean;
};

type Props = {
  onCamera: () => void;
  onSelect: () => void;
  onSearch: () => void;
  isSelecting?: boolean;
};

const PULL_UP_EASING = Easing.bezier(0.22, 1.12, 0.36, 1);
const ENTRANCE_DURATION = 680;

export function MomentBottomNav({
  onCamera,
  onSelect,
  onSearch,
  isSelecting = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      120,
      withTiming(1, {
        duration: ENTRANCE_DURATION,
        easing: PULL_UP_EASING,
      })
    );
  }, [progress]);

  const animatedBarStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const eased = 1 - Math.pow(1 - t, 3);

    return {
      opacity: Math.min(t * 1.6, 1),
      transform: [
        { translateY: (1 - eased) * 72 },
        { scaleX: 0.28 + eased * 0.72 },
        { scaleY: 0.12 + eased * 0.88 },
      ],
    };
  });

  const items: NavItem[] = [
    {
      id: 'camera',
      label: 'Camera',
      iosSymbol: 'camera.fill',
      androidSymbol: 'photo_camera',
      onPress: onCamera,
    },
    {
      id: 'select',
      label: isSelecting ? 'Cancel' : 'Select',
      iosSymbol: 'checkmark.circle',
      androidSymbol: 'check_circle',
      onPress: onSelect,
      isActive: isSelecting,
    },
    {
      id: 'search',
      label: 'Search',
      iosSymbol: 'magnifyingglass',
      androidSymbol: 'search',
      onPress: onSearch,
    },
  ];

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: insets.bottom + 16 }]}>
      <Animated.View style={[styles.bar, animatedBarStyle]}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.item,
              item.isActive && styles.itemActive,
              pressed && styles.itemPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <SymbolView
              name={{ ios: item.iosSymbol, android: item.androidSymbol }}
              size={24}
              tintColor={item.isActive ? '#6eb5ff' : '#fff'}
              weight="medium"
            />
            <Text style={[styles.label, item.isActive && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 5,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: 260,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(28, 28, 30, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    transformOrigin: 'bottom center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 16,
  },
  itemActive: {
    backgroundColor: 'rgba(110, 181, 255, 0.12)',
  },
  itemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: '500',
  },
  labelActive: {
    color: '#6eb5ff',
  },
});
