import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function MomentRoll() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Roll: {id}</Text>
    </View>
  );
}
