import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { type RefObject } from 'react';
import { Platform, StyleSheet, Text, View, type View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HORIZONTAL_PADDING = 16;
const BACKDROP_EXTENSION = 50;
const CONTENT_GAP = 4;

export function getMomentHeaderScrollInset(topInset: number): number {
  return topInset + BACKDROP_EXTENSION + CONTENT_GAP;
}

type Props = {
  name: string;
  blurTargetRef: RefObject<RNView | null>;
};

export function MomentNameHeader({ name, blurTargetRef }: Props) {
  const insets = useSafeAreaInsets();
  const backdropHeight = insets.top + BACKDROP_EXTENSION;

  return (
    <View style={[styles.wrapper, { height: backdropHeight }]} pointerEvents="box-none">
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient
            colors={['#000000', '#000000', 'rgba(0, 0, 0, 0.45)', 'transparent']}
            locations={[0, 0.32, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        <BlurView
          blurTarget={blurTargetRef}
          intensity={Platform.OS === 'ios' ? 72 : 52}
          tint="light"
          style={StyleSheet.absoluteFill}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        />
      </MaskedView>

      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.94)',
          'rgba(255, 255, 255, 0.72)',
          'rgba(255, 255, 255, 0)',
        ]}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.titleRow, { paddingTop: insets.top + 4 }]}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  titleRow: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.4,
  },
});
