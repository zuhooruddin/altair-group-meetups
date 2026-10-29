import { fireEvent, screen } from '@testing-library/react-native';
import { MeetupListScreen } from '../src/features/meetups/screens/MeetupListScreen';
import { MAPLE, fakeNavigation, fakeServices, renderWithServices, summary } from './helpers';

const RIVERSIDE = 'b2000000-0000-4000-8000-000000000002';
const groups = [
  { id: MAPLE, name: 'Maple Street Walkers' },
  { id: RIVERSIDE, name: 'Riverside Loop Walkers' },
];

const renderList = (services: ReturnType<typeof fakeServices>, navigation = fakeNavigation()) =>
  renderWithServices(
    <MeetupListScreen route={{ key: 'm', name: 'Meetups' } as never} navigation={navigation} />,
    services,
  );

describe('MeetupListScreen', () => {
  it('loads groups, picks the first, and lists its meetups including cancelled ones', async () => {
    const listForGroup = jest.fn(async () => [
      summary(),
      summary({
        id: 'c3000000-0000-4000-8000-000000000002',
        title: 'Weeknight short walk',
        status: 'cancelled',
        cancelledAt: '2026-10-29T12:00:00.000Z',
      }),
    ]);
    await renderList(
      fakeServices({ groups: { listMine: async () => groups }, meetups: { listForGroup } }),
    );

    expect(screen.getByTestId('state-loading')).toBeTruthy();
    expect(await screen.findByText('Saturday morning loop')).toBeTruthy();
    expect(screen.getByText('Weeknight short walk')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(listForGroup).toHaveBeenCalledWith(MAPLE);
  });

  it('switches group when another chip is pressed', async () => {
    const listForGroup = jest.fn(async () => [summary()]);
    await renderList(
      fakeServices({ groups: { listMine: async () => groups }, meetups: { listForGroup } }),
    );
    await fireEvent.press(await screen.findByTestId(`group-chip-${RIVERSIDE}`));
    await screen.findByText('Saturday morning loop');
    expect(listForGroup).toHaveBeenCalledWith(RIVERSIDE);
  });

  it('shows the empty state with a create action', async () => {
    const navigation = fakeNavigation() as unknown as { navigate: jest.Mock };
    await renderList(
      fakeServices({
        groups: { listMine: async () => groups },
        meetups: { listForGroup: async () => [] },
      }),
      navigation as never,
    );
    expect(await screen.findByText('No meetups yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Create a meetup'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateMeetup', { groupId: MAPLE });
  });

  it('shows an error state when meetups fail to load', async () => {
    await renderList(
      fakeServices({
        groups: { listMine: async () => groups },
        meetups: {
          listForGroup: async () => Promise.reject(new Error('Could not reach the server.')),
        },
      }),
    );
    expect(await screen.findByTestId('state-error')).toBeTruthy();
    expect(screen.getByText('Could not reach the server.')).toBeTruthy();
  });

  it('tells a member with no groups that there is nothing to show', async () => {
    await renderList(fakeServices({ groups: { listMine: async () => [] } }));
    expect(await screen.findByText('You’re not in any walking groups yet')).toBeTruthy();
  });

  it('previews the place name only when the server sent the exact point', async () => {
    await renderList(
      fakeServices({
        groups: { listMine: async () => groups },
        meetups: { listForGroup: async () => [summary()] },
      }),
    );
    expect(await screen.findByText('Approximate area · RSVP to see the spot')).toBeTruthy();
    expect(screen.queryByText('North gate, Linden Park')).toBeNull();
  });
});
