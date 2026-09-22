import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

type Props = {
  uri: string;
};

export function VideoPlayerView({ uri }: Props) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.pause();
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
    />
  );
}

const styles = StyleSheet.create({
  video: {
    flex: 1,
    width: '100%',
  },
});
