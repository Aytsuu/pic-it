import { Pressable, Text } from 'react-native';

type Props = {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  onPress: () => void;
};

export function MomentCard({ name, createdAt, memberCount, onPress }: Props) {
  const date = new Date(createdAt).toLocaleDateString();

  return (
    <Pressable
      onPress={onPress}
      style={{ padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600' }}>{name}</Text>
      <Text style={{ color: '#666', marginTop: 4 }}>
        {date} · {memberCount} member{memberCount !== 1 ? 's' : ''}
      </Text>
    </Pressable>
  );
}
