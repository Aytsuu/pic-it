import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { isOnline } from '@/lib/network';
import { syncAllPending } from '@/lib/sync';

export function useSync() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  const runSync = useCallback(async () => {
    if (!user || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      await syncAllPending(user.id);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    void isOnline().then((online) => {
      if (online) void runSync();
    });

    const unsubNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void runSync();
    });

    const unsubAppState = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void runSync();
    });

    return () => {
      unsubNetInfo();
      unsubAppState.remove();
    };
  }, [runSync]);

  return { isSyncing, syncNow: runSync };
}
