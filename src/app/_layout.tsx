import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';

import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient();

// Ensure Supabase client is initialised at app startup.
void supabase;

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  );
}
