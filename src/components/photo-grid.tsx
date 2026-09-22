import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';

import { PhotoCell } from '@/components/photo-cell';
import { SyncStatus } from '@/lib/queue';

export type GridItem = {
  key: string;
  source: string;
  syncStatus: SyncStatus;
  isPicked?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  onDetailPress?: () => void;
  onFailedPress?: () => void;
};

type Props = {
  items: GridItem[];
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
  isSelecting?: boolean;
  initialScrollToEnd?: boolean;
};

export function PhotoGrid({
  items,
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
  isSelecting = false,
  initialScrollToEnd = false,
}: Props) {
  const initialScrollIndex =
    initialScrollToEnd && items.length > 0 ? items.length - 1 : undefined;

  return (
    <FlashList
      data={items}
      numColumns={3}
      initialScrollIndex={initialScrollIndex}
      keyExtractor={(item) => item.key}
      contentContainerStyle={{
        paddingTop: contentPaddingTop,
        paddingBottom: contentPaddingBottom,
      }}
      renderItem={({ item }) => (
        <PhotoCell
          source={item.source}
          syncStatus={item.syncStatus}
          isPicked={item.isPicked}
          isSelecting={isSelecting}
          isSelected={item.isSelected}
          onPress={item.onPress}
          onDetailPress={item.onDetailPress}
          onFailedPress={item.onFailedPress}
        />
      )}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 48 }} />
      }
    />
  );
}
