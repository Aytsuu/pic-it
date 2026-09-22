import { useEffect, useState, type RefObject } from 'react';
import { TextInput, type View as RNView } from 'react-native';

import { BlurFormOverlay, blurFormFieldStyles } from '@/components/blur-form-overlay';
import { useAuth } from '@/hooks/use-auth';
import { joinMoment } from '@/lib/join-moment';

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  onClose: () => void;
  onJoined: (momentId: string, name: string) => void;
};

export function JoinMomentOverlay({ visible, blurTargetRef, onClose, onJoined }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCode('');
    setError(null);
    setIsSubmitting(false);
  }, [visible]);

  async function handleJoin() {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await joinMoment(user.id, code);

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onJoined(result.momentId, result.name);
  }

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="Join Moment"
      actionLabel="Join"
      onClose={onClose}
      onAction={() => void handleJoin()}
      actionDisabled={!code.trim()}
      isSubmitting={isSubmitting}
      error={error}
    >
      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase())}
        placeholder="Enter code"
        placeholderTextColor="rgba(60, 60, 67, 0.45)"
        autoFocus
        editable={!isSubmitting}
        returnKeyType="done"
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        onSubmitEditing={() => void handleJoin()}
        style={blurFormFieldStyles.codeInput}
      />
    </BlurFormOverlay>
  );
}
