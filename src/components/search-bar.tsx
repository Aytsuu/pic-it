import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { DownloadProgress } from '@/lib/model-manager';

type Props = {
  query: string;
  onQueryChange: (text: string) => void;
  isSearching: boolean;
  modelsReady: boolean;
  downloadProgress: DownloadProgress | null;
  error?: string | null;
  emptyMessage?: string | null;
};

export function SearchBar({
  query,
  onQueryChange,
  isSearching,
  modelsReady,
  downloadProgress,
  error,
  emptyMessage,
}: Props) {
  if (!modelsReady) {
    const pct = downloadProgress
      ? `${Math.round(downloadProgress.fraction * 100)}%`
      : '…';

    return (
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Preparing search ({pct})</Text>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search photos…"
          placeholderTextColor="#888"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {isSearching && <ActivityIndicator size="small" style={styles.spinner} />}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && emptyMessage ? <Text style={styles.hint}>{emptyMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#1c1c1e',
    color: '#fff',
    fontSize: 16,
  },
  spinner: {
    marginLeft: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  bannerText: {
    color: '#888',
    fontSize: 14,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  hint: {
    color: '#888',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});
