import { Button, Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';

export default function Home() {
  const { signOut } = useAuth();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text>Home</Text>
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}
