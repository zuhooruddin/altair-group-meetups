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
import { useAuth } from '../../auth/AuthProvider';
import { GroupPicker } from '../../groups/GroupPicker';
import { useMyGroups } from '../../groups/hooks';
import { MeetupCard } from '../components/MeetupCard';
import { useGroupMeetups } from '../hooks';

export function MeetupListScreen({ navigation }: ScreenProps<'Meetups'>) {
  const { signOut } = useAuth();
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
        <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="Sign out" hitSlop={10} testID="sign-out">
          <Ionicons name="log-out-outline" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

  const openMeetup = useCallback(
    (meetup: MeetupSummary) => navigation.navigate('MeetupDetail', { meetupId: meetup.id }),
    [navigation],
  );
  const createMeetup = () => selectedGroupId && navigation.navigate('CreateMeetup', { groupId: selectedGroupId });

  if (groupsQuery.isPending) return <LoadingState message="Loading your groups…" />;
  if (groupsQuery.isError) return <ErrorState message={messageFor(groupsQuery.error)} onRetry={() => groupsQuery.refetch()} />;
  if (groupsQuery.data.length === 0) {
    return <EmptyState title="You’re not in any walking groups yet" message="Once a neighbor adds you to a group, its meetups show up here." />;
  }

  const renderBody = () => {
    if (meetupsQuery.isPending) return <LoadingState message="Loading meetups…" />;
    if (meetupsQuery.isError) return <ErrorState message={messageFor(meetupsQuery.error)} onRetry={() => meetupsQuery.refetch()} />;
    return (
      <FlatList
        data={meetupsQuery.data}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MeetupCard meetup={item} onPress={openMeetup} />}
        contentContainerStyle={meetupsQuery.data.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl refreshing={meetupsQuery.isRefetching} onRefresh={() => void meetupsQuery.refetch()} tintColor={colors.primary} />
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
      <GroupPicker groups={groupsQuery.data} selectedId={selectedGroupId} onSelect={setSelectedGroupId} />
      <Text style={styles.sectionLabel}>Upcoming & recent · soonest first</Text>
      <View style={styles.body}>{renderBody()}</View>
      <View style={styles.footer}>
        <Button label="New meetup" onPress={createMeetup} disabled={!selectedGroupId} testID="new-meetup-button" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  sectionLabel: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  body: { flex: 1 },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  emptyContainer: { flexGrow: 1 },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
});
