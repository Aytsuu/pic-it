import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';

import { BlurFormOverlay } from '@/components/blur-form-overlay';
import { fetchMomentDetails } from '@/lib/moment-info';
import { buildMomentInviteMessage } from '@/lib/moment-invite';

type Props = {
  visible: boolean;
  momentId: string;
  blurTargetRef: RefObject<RNView | null>;
  onClose: () => void;
};

export function MomentInfoOverlay({ visible, momentId, blurTargetRef, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['moment-details', momentId],
    enabled: visible && !!momentId,
    queryFn: () => fetchMomentDetails(momentId),
  });

  useEffect(() => {
    if (!visible) {
      setCopied(false);
      return;
    }
    void refetch();
  }, [visible, refetch]);

  async function handleCopyCode() {
    if (!data?.code) return;

    await Clipboard.setStringAsync(data.code);
    setCopied(true);
    Alert.alert('Copied', 'Moment code copied to clipboard.');
  }

  async function handleInvite() {
    if (!data) return;

    try {
      await Share.share({
        message: buildMomentInviteMessage(data.name, data.code),
      });
    } catch {
      Alert.alert('Could not share', 'Something went wrong while creating the invite.');
    }
  }

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="Info"
      actionLabel=""
      onClose={onClose}
      onAction={onClose}
      hideHeaderActions
    >
      {isLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>
          {getErrorMessage(error)}
        </Text>
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Pressable
            onPress={() => void handleCopyCode()}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel="Copy moment code"
          >
            <Text style={styles.cardLabel}>Code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{data.code}</Text>
              <SymbolView
                name={{ ios: 'doc.on.doc', android: 'content_copy' }}
                size={20}
                tintColor="#007AFF"
                weight="medium"
              />
            </View>
            <Text style={styles.hint}>{copied ? 'Copied to clipboard' : 'Tap to copy'}</Text>
          </Pressable>

          <View style={styles.card}>
            <View style={styles.membersHeader}>
              <Pressable
                onPress={() => void handleInvite()}
                style={({ pressed }) => [styles.inviteIconButton, pressed && styles.inviteIconPressed]}
                accessibilityRole="button"
                accessibilityLabel="Invite people"
                hitSlop={8}
              >
                <SymbolView
                  name={{ ios: 'person.badge.plus', android: 'group_add' }}
                  size={22}
                  tintColor="#007AFF"
                  weight="medium"
                />
              </Pressable>
              <Text style={styles.membersTitle}>Members</Text>
            </View>

            <View style={styles.memberList}>
              {data.members.map((member, index) => {
                const isCreator = member.user_id === data.host_id;
                const isLast = index === data.members.length - 1;

                return (
                  <View
                    key={member.user_id}
                    style={[styles.memberRow, isLast && styles.memberRowLast]}
                  >
                    <Text style={styles.memberName}>{member.display_name}</Text>
                    {isCreator ? <Text style={styles.creatorBadge}>Creator</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.errorText}>Could not load moment info</Text>
      )}
    </BlurFormOverlay>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Could not load moment info';
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 24,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 15,
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(60, 60, 67, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#111',
  },
  hint: {
    fontSize: 14,
    color: 'rgba(60, 60, 67, 0.72)',
    marginTop: 8,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  inviteIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inviteIconPressed: {
    opacity: 0.6,
  },
  membersTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
  },
  memberList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60, 60, 67, 0.12)',
    paddingTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.08)',
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberName: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
    flex: 1,
  },
  creatorBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 12,
  },
});
