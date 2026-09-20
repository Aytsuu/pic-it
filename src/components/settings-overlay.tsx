import { type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type View as RNView } from 'react-native';

import { BlurFormOverlay } from '@/components/blur-form-overlay';
import { useAuth } from '@/hooks/use-auth';

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  onClose: () => void;
};

export function SettingsOverlay({ visible, blurTargetRef, onClose }: Props) {
  const { user, signOut } = useAuth();

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="Settings"
      actionLabel=""
      onClose={onClose}
      onAction={onClose}
      hideHeaderActions
    >
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <Text style={styles.email}>{user?.email ?? 'Signed in'}</Text>
      </View>

      <Pressable
        onPress={() => {
          onClose();
          void signOut();
        }}
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </BlurFormOverlay>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  email: {
    fontSize: 17,
    color: '#111',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  signOutButtonPressed: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ff3b30',
  },
});
