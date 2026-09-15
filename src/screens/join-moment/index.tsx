import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export function JoinMomentScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  async function handleJoin() {
    if (!code.trim() || !user) return;
    setError(null);

    const { data: moment, error: lookupErr } = await supabase
      .from('moments')
      .select('id')
      .eq('code', code.toUpperCase())
      .single();

    if (lookupErr || !moment) {
      setError('Moment not found');
      return;
    }

    const { error: memberErr } = await supabase
      .from('members')
      .upsert({ moment_id: moment.id, user_id: user.id });

    if (memberErr) {
      setError(memberErr.message);
      return;
    }

    router.replace(`/moment/${moment.id}` as any);
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
