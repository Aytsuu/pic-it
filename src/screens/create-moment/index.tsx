import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { createMoment } from '@/lib/create-moment';

export function CreateMomentScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    if (!user) return;
    setError(null);

    const result = await createMoment(user.id, name);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace(`/moment/${result.momentId}` as any);
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
      <TextInput
        placeholder="Moment name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Create" onPress={handleSubmit} />
    </View>
  );
}
