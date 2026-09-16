import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';

import { PhotoCell } from '@/components/photo-cell';
import { SyncStatus } from '@/lib/queue';

export type GridItem = {
  key: string;
  source: string;
  syncStatus: SyncStatus;
  onFailedPress?: () => void;
};

type Props = { items: GridItem[] };

export function PhotoGrid({ items }: Props) {
  return (
    <FlashList
      data={items}
      numColumns={3}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => (
        <PhotoCell
          source={item.source}
          syncStatus={item.syncStatus}
          onFailedPress={item.onFailedPress}
        />
      )}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 48 }} />
      }
    />
  );
}
