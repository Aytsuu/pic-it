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
  id: 'join' | 'create' | 'search' | 'settings';
  label: string;
  iosSymbol: 'person.badge.plus' | 'plus.circle.fill' | 'magnifyingglass' | 'gearshape.fill';
  androidSymbol: 'group_add' | 'add_circle' | 'search' | 'settings';
  onPress: () => void;
};

type Props = {
  onJoin: () => void;
  onCreate: () => void;
  onSearch: () => void;
  onSettings: () => void;
};

const PULL_UP_EASING = Easing.bezier(0.22, 1.12, 0.36, 1);
const ENTRANCE_DURATION = 680;

export function FloatingBottomNav({ onJoin, onCreate, onSearch, onSettings }: Props) {
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
      id: 'join',
      label: 'Join',
      iosSymbol: 'person.badge.plus',
      androidSymbol: 'group_add',
      onPress: onJoin,
    },
    {
      id: 'create',
      label: 'Create',
      iosSymbol: 'plus.circle.fill',
      androidSymbol: 'add_circle',
      onPress: onCreate,
    },
    {
      id: 'search',
      label: 'Search',
      iosSymbol: 'magnifyingglass',
      androidSymbol: 'search',
      onPress: onSearch,
    },
    {
      id: 'settings',
      label: 'Settings',
      iosSymbol: 'gearshape.fill',
      androidSymbol: 'settings',
      onPress: onSettings,
    },
  ];

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: insets.bottom + 16 }]}>
      <Animated.View style={[styles.bar, animatedBarStyle]}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <SymbolView
              name={{ ios: item.iosSymbol, android: item.androidSymbol }}
              size={24}
              tintColor="#fff"
              weight="medium"
            />
            <Text style={styles.label}>{item.label}</Text>
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
    width: 320,
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
  itemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: '500',
  },
});
