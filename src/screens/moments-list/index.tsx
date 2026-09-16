import { ActivityIndicator, Button, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { MomentCard } from '@/components/moment-card';
import { useAuth } from '@/hooks/use-auth';
import {
  CachedMemberRow,
  fetchWithCache,
  getCachedMoments,
  saveMoments,
} from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';

type MomentSummary = {
  id: string;
  name: string;
  created_at: string;
};

type MemberRow = {
  moment_id: string;
  moments: MomentSummary | MomentSummary[] | null;
};

function getMoment(row: MemberRow | CachedMemberRow): MomentSummary | null {
  if (!row.moments) return null;
  return Array.isArray(row.moments) ? row.moments[0] ?? null : row.moments;
}

export function MomentsListScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['moments', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const userId = user!.id;

      return fetchWithCache({
        fetchRemote: async () => {
          const { data: rows, error: queryError } = await supabase
            .from('members')
            .select('moment_id, moments(id, name, created_at)')
            .eq('user_id', userId);

          if (queryError) throw queryError;
          return (rows ?? []) as MemberRow[];
        },
        readCache: () => getCachedMoments(userId),
        writeCache: (rows) => {
          const moments = rows
            .map((row) => getMoment(row))
            .filter((moment): moment is MomentSummary => moment !== null);

          saveMoments(userId, moments);
        },
      });
    },
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  if (!data?.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text>No moments yet</Text>
        <Button title="Create a moment" onPress={() => router.push('/(app)/create' as any)} />
        <Button title="Join a moment" onPress={() => router.push('/(app)/join' as any)} />
        <Button title="Sign out" onPress={signOut} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <Button title="Sign out" onPress={signOut} />
        <Button title="Join" onPress={() => router.push('/(app)/join' as any)} />
        <Button title="+" onPress={() => router.push('/(app)/create' as any)} />
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.moment_id}
        renderItem={({ item }) => {
          const moment = getMoment(item);
          return (
            <MomentCard
              id={item.moment_id}
              name={moment?.name ?? '—'}
              createdAt={moment?.created_at ?? ''}
              memberCount={1}
              onPress={() => router.push(`/moment/${item.moment_id}` as any)}
            />
          );
        }}
      />
    </View>
  );
}
