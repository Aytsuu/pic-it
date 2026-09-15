import { Href, Redirect, Stack } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  return <Stack />;
}
