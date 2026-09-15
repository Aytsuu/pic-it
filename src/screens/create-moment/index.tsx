import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { generateCode } from '@/utils/generate-code';

export function CreateMomentScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    if (!name.trim() || !user) return;
    setError(null);

    const code = generateCode();

    const { data: moment, error: momentErr } = await supabase
      .from('moments')
      .insert({ name: name.trim(), host_id: user.id, code })
      .select('id')
      .single();

    if (momentErr || !moment) {
      setError(momentErr?.message ?? 'Failed');
      return;
    }

    await supabase.from('members').insert({ moment_id: moment.id, user_id: user.id });

    router.replace(`/moment/${moment.id}` as any);
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
