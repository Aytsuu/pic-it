import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

async function removeMomentPhotoChannels(momentId: string): Promise<void> {
  const prefix = `realtime:photos:${momentId}`;

  for (const channel of [...supabase.getChannels()]) {
    if (channel.topic.startsWith(prefix)) {
      await supabase.removeChannel(channel);
    }
  }
}

export function useMomentPhotoInserts(
  momentId: string | undefined,
  onChange: () => void
): void {
  useFocusEffect(
    useCallback(() => {
      if (!momentId) return;

      let channel: RealtimeChannel | null = null;
      let cancelled = false;

      void (async () => {
        await removeMomentPhotoChannels(momentId);
        if (cancelled) return;

        const channelName = `photos:${momentId}:${randomUUID()}`;
        const nextChannel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'photos',
              filter: `moment_id=eq.${momentId}`,
            },
            onChange
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'photos',
              filter: `moment_id=eq.${momentId}`,
            },
            onChange
          )
          .subscribe();

        if (cancelled) {
          await supabase.removeChannel(nextChannel);
          return;
        }

        channel = nextChannel;
      })();

      return () => {
        cancelled = true;
        if (channel) {
          void supabase.removeChannel(channel);
        }
        void removeMomentPhotoChannels(momentId);
      };
    }, [momentId, onChange])
  );
}

export function useMomentsPhotoChanges(momentIds: string[], onChange: () => void): void {
  const idsKey = momentIds.join(',');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useFocusEffect(
    useCallback(() => {
      const idSet = new Set(idsKey.split(',').filter(Boolean));
      if (idSet.size === 0) return;

      let timer: ReturnType<typeof setTimeout> | null = null;
      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => onChangeRef.current(), 400);
      };

      const channel = supabase
        .channel(`photos-home:${randomUUID()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'photos' },
          (payload) => {
            const momentId = (payload.new as { moment_id?: string } | null)?.moment_id;
            if (momentId && idSet.has(momentId)) schedule();
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'photos' },
          (payload) => {
            const momentId = (payload.old as { moment_id?: string } | null)?.moment_id;
            if (momentId && idSet.has(momentId)) schedule();
          }
        )
        .subscribe();

      return () => {
        if (timer) clearTimeout(timer);
        void supabase.removeChannel(channel);
      };
    }, [idsKey])
  );
}
