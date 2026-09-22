import { useEffect, useState, type RefObject } from 'react';
import { TextInput, type View as RNView } from 'react-native';

import { BlurFormOverlay, blurFormFieldStyles } from '@/components/blur-form-overlay';
import { useAuth } from '@/hooks/use-auth';
import { createMoment } from '@/lib/create-moment';

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  onClose: () => void;
  onCreated: (momentId: string, name: string) => void;
};

export function CreateMomentOverlay({ visible, blurTargetRef, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setError(null);
    setIsSubmitting(false);
  }, [visible]);

  async function handleSubmit() {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await createMoment(user.id, name);

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onCreated(result.momentId, name.trim());
  }

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="New Moment"
      actionLabel="Create"
      onClose={onClose}
      onAction={() => void handleSubmit()}
      actionDisabled={!name.trim()}
      isSubmitting={isSubmitting}
      error={error}
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name this moment"
        placeholderTextColor="rgba(60, 60, 67, 0.45)"
        autoFocus
        editable={!isSubmitting}
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
        style={blurFormFieldStyles.input}
      />
    </BlurFormOverlay>
  );
}
