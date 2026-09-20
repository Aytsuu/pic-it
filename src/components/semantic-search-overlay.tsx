import { Image } from 'expo-image';
import { useEffect, useRef, type RefObject } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type View as RNView,
} from 'react-native';

import { BlurFormOverlay, blurFormFieldStyles } from '@/components/blur-form-overlay';
import { DownloadProgress } from '@/lib/model-manager';
import { getPhotoDisplayUri } from '@/lib/photo-cache';
import type { SearchResult } from '@/lib/semantic-search';

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  onClose: () => void;
  query: string;
  onQueryChange: (text: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  modelsReady: boolean;
  downloadProgress: DownloadProgress | null;
  error?: string | null;
  emptyMessage?: string | null;
  isPreviewMode?: boolean;
  onResultPress: (result: SearchResult) => void;
};

export function SemanticSearchOverlay({
  visible,
  blurTargetRef,
  onClose,
  query,
  onQueryChange,
  results,
  isSearching,
  modelsReady,
  downloadProgress,
  error,
  emptyMessage,
  isPreviewMode = false,
  onResultPress,
}: Props) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 280);

    return () => clearTimeout(timer);
  }, [visible]);

  const preparingPct = downloadProgress
    ? `${Math.round(downloadProgress.fraction * 100)}%`
    : '…';

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="Search"
      actionLabel=""
      onClose={onClose}
      onAction={onClose}
      hideHeaderActions
    >
      {!modelsReady ? (
        <View style={styles.preparing}>
          <Text style={styles.preparingText}>Preparing search ({preparingPct})</Text>
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={onQueryChange}
            placeholder="Describe a photo…"
            placeholderTextColor="rgba(60, 60, 67, 0.45)"
            multiline
            textAlignVertical="top"
            returnKeyType="search"
            style={[blurFormFieldStyles.input, styles.queryInput]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && emptyMessage ? <Text style={styles.hint}>{emptyMessage}</Text> : null}

          {isSearching ? (
            <ActivityIndicator size="small" style={styles.spinner} />
          ) : null}

          {query.trim() && results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.photoId}
              keyboardShouldPersistTaps="handled"
              style={styles.results}
              contentContainerStyle={styles.resultsContent}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onResultPress(item)}
                  style={styles.resultRow}
                >
                  <Image
                    source={{ uri: getPhotoDisplayUri(item.photoId, item.storagePath) }}
                    style={styles.resultThumb}
                    contentFit="cover"
                  />
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultMatch}>
                      Match {Math.round(item.similarity * 100)}%
                    </Text>
                    <Text style={styles.resultPath} numberOfLines={1}>
                      {item.storagePath}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          ) : null}
        </>
      )}
    </BlurFormOverlay>
  );
}

const styles = StyleSheet.create({
  preparing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  preparingText: {
    fontSize: 16,
    color: 'rgba(60, 60, 67, 0.72)',
  },
  queryInput: {
    minHeight: 96,
    maxHeight: 160,
    marginBottom: 8,
  },
  previewHint: {
    color: '#007AFF',
    fontSize: 14,
    marginBottom: 8,
  },
  error: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(60, 60, 67, 0.72)',
    fontSize: 14,
    marginBottom: 8,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  results: {
    maxHeight: 360,
  },
  resultsContent: {
    paddingBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.18)',
  },
  resultThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#e5e5ea',
  },
  resultMeta: {
    flex: 1,
  },
  resultMatch: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  resultPath: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.72)',
    marginTop: 2,
  },
});
