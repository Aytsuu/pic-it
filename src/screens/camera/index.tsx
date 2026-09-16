import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import * as queue from '@/lib/queue';
import { scheduleSync } from '@/lib/sync';

export function CameraScreen() {
  const { id: momentId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera access is required to shoot photos.</Text>
        <Button title="Grant permission" onPress={requestPermission} />
      </View>
    );
  }

  async function handleShutter() {
    if (!cameraRef.current || !momentId) return;

    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (!photo?.uri) return;

    queue.enqueue(momentId, photo.uri);

    if (user) {
      void scheduleSync(user.id, momentId);
    }

    router.back();
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.shutter} onPress={handleShutter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  controls: { position: 'absolute', bottom: 48, width: '100%', alignItems: 'center' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#ccc',
  },
});
