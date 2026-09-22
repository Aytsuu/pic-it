import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatZoomChipLabel,
  formatZoomPresetLabel,
  getActiveZoomPreset,
  isZoomPresetAvailable,
  type ZoomPreset,
  ZOOM_PRESETS,
} from '@/lib/camera-zoom';

type Props = {
  displayZoom: number;
  availableLenses: string[];
  onChange: (preset: ZoomPreset) => void;
};

const CHIP_WIDTH = 44;

export function CameraZoomControls({ displayZoom, availableLenses, onChange }: Props) {
  const activePreset = getActiveZoomPreset(displayZoom, availableLenses);
  const activeLabel = formatZoomChipLabel(displayZoom, availableLenses);

  return (
    <View style={styles.row}>
      {ZOOM_PRESETS.map((preset) => {
        const isActive = activePreset === preset;
        const isAvailable = isZoomPresetAvailable(preset, availableLenses);
        const label = isActive ? activeLabel : formatZoomPresetLabel(preset);

        return (
          <Pressable
            key={preset}
            onPress={() => isAvailable && onChange(preset)}
            disabled={!isAvailable}
            style={[
              styles.chip,
              isActive && styles.chipActive,
              !isAvailable && styles.chipDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${label} times zoom`}
            accessibilityState={{ selected: isActive, disabled: !isAvailable }}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  chip: {
    width: CHIP_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chipTextActive: {
    color: '#f5d442',
  },
});
