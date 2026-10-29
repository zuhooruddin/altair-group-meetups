import type { MeetupSummary } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { messageFor } from '../../../core/api/api-error';
import type { ScreenProps } from '../../../navigation/types';
import { Button } from '../../../ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../../ui/StateViews';
import { colors, spacing, typography } from '../../../ui/theme';
import { useAuth, useCurrentUserId } from '../../auth/AuthProvider';
import { Avatar } from '../../../ui/Avatar';
import { GroupPicker } from '../../groups/GroupPicker';
import { useMyGroups } from '../../groups/hooks';
import { MeetupCard } from '../components/MeetupCard';
import { useGroupMeetups } from '../hooks';

export function MeetupListScreen({ navigation }: ScreenProps<'Meetups'>) {
  const { signOut } = useAuth();
  const currentUserId = useCurrentUserId();
  const groupsQuery = useMyGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const meetupsQuery = useGroupMeetups(selectedGroupId);

  // Default to the member's first group once groups load.
  useEffect(() => {
    const groups = groupsQuery.data;
    if (groups && groups.length > 0 && !groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(groups[0]!.id);
    }
  }, [groupsQuery.data, selectedGroupId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={10}
          testID="sign-out"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

  const openMeetup = useCallback(
    (meetup: MeetupSummary) => navigation.navigate('MeetupDetail', { meetupId: meetup.id }),
    [navigation],
  );
  const createMeetup = () =>
    selectedGroupId && navigation.navigate('CreateMeetup', { groupId: selectedGroupId });

  if (groupsQuery.isPending) return <LoadingState message="Loading your groups…" />;
  if (groupsQuery.isError)
    return (
      <ErrorState message={messageFor(groupsQuery.error)} onRetry={() => groupsQuery.refetch()} />
    );
  if (groupsQuery.data.length === 0) {
    return (
      <EmptyState
        title="You’re not in any walking groups yet"
        message="Once a neighbor adds you to a group, its meetups show up here."
      />
    );
  }

  const renderBody = () => {
    if (meetupsQuery.isPending) return <LoadingState message="Loading meetups…" />;
    if (meetupsQuery.isError)
      return (
        <ErrorState
          message={messageFor(meetupsQuery.error)}
          onRetry={() => meetupsQuery.refetch()}
        />
      );
    return (
      <FlatList
        data={meetupsQuery.data}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MeetupCard meetup={item} onPress={openMeetup} />}
        contentContainerStyle={meetupsQuery.data.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={meetupsQuery.isRefetching}
            onRefresh={() => void meetupsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No meetups yet"
            message="Be the first to plan a walk with your group."
            action={{ label: 'Create a meetup', onPress: createMeetup }}
          />
        }
        testID="meetup-list"
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.welcome}>
        <View style={styles.welcomeCopy}>
          <Text style={styles.eyebrow}>A LITTLE FRESH AIR, TOGETHER</Text>
          <Text style={styles.greeting}>Hello, neighbor.</Text>
          <Text style={styles.subtitle}>Your next walk starts here.</Text>
        </View>
        <View style={styles.welcomeIcon}>
          <Avatar userId={currentUserId ?? undefined} name="Your profile" size={54} />
        </View>
      </View>
      <Text style={styles.groupsTitle}>Your groups</Text>
      <GroupPicker
        groups={groupsQuery.data}
        selectedId={selectedGroupId}
        onSelect={setSelectedGroupId}
      />
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionLabel}>Upcoming meetups</Text>
        <View style={styles.sortLabel}>
          <Text style={styles.sortText}>Soonest first</Text>
          <Ionicons name="swap-vertical" size={14} color={colors.primary} />
        </View>
      </View>
      <View style={styles.body}>{renderBody()}</View>
      <View style={styles.footer}>
        <Button
          label="+  Create new meetup"
          onPress={createMeetup}
          disabled={!selectedGroupId}
          testID="new-meetup-button"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  welcomeCopy: { flex: 1 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  greeting: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  welcomeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupsTitle: { ...typography.heading, color: colors.text, paddingHorizontal: spacing.lg },
  sectionLabel: {
    ...typography.heading,
    color: colors.text,
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sortLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sortText: { ...typography.caption, color: colors.textMuted },
  body: { flex: 1 },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  emptyContainer: { flexGrow: 1 },
  footer: {
    padding: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
});
