import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { joinMoment } from '@/lib/join-moment';

export function JoinMomentScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  async function handleJoin() {
    if (!user) return;
    setError(null);

    const result = await joinMoment(user.id, code);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.replace(`/moment/${result.momentId}` as any);
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
      <TextInput
        placeholder="Enter 6-character code"
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        style={{ borderWidth: 1, padding: 12, borderRadius: 8, letterSpacing: 4 }}
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Join" onPress={handleJoin} />
    </View>
  );
}
