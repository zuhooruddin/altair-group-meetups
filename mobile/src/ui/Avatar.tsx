import { Image, StyleSheet, Text, View } from 'react-native';
import avery from '../../assets/avatar-avery.png';
import jordan from '../../assets/avatar-jordan.png';
import sam from '../../assets/avatar-sam.png';
import riley from '../../assets/avatar-riley.png';
import taylor from '../../assets/avatar-taylor.png';
import { colors } from './theme';

/** Illustrative portraits belong only to the seeded, fictional demo accounts. */
const demoPortraits = [
  { id: 'a1000000-0000-4000-8000-000000000001', email: 'avery@example.test', source: avery },
  { id: 'a1000000-0000-4000-8000-000000000002', email: 'jordan@example.test', source: jordan },
  { id: 'a1000000-0000-4000-8000-000000000003', email: 'sam@example.test', source: sam },
  { id: 'a1000000-0000-4000-8000-000000000004', email: 'riley@example.test', source: riley },
  { id: 'a1000000-0000-4000-8000-000000000007', email: 'taylor@example.test', source: taylor },
];

export function Avatar({
  userId,
  demoEmail,
  name,
  size = 44,
}: {
  userId?: string;
  demoEmail?: string;
  name: string;
  size?: number;
}) {
  const portrait = demoPortraits.find(
    (person) => person.id === userId || person.email === demoEmail,
  );
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return portrait ? (
    <Image
      source={portrait.source}
      style={[styles.image, dimensions]}
      accessibilityLabel={`${name} avatar`}
    />
  ) : (
    <View style={[styles.fallback, dimensions]} accessibilityLabel={`${name} avatar`}>
      <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.3) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderWidth: 1, borderColor: '#DCE5DE', backgroundColor: colors.secondary },
  fallback: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE5DE',
  },
  initials: { color: colors.primary, fontWeight: '600' },
});
