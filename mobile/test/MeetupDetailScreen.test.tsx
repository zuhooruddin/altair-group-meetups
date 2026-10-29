import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { MeetupDetailScreen } from '../src/features/meetups/screens/MeetupDetailScreen';
import {
  AVERY,
  SAM,
  SATURDAY,
  detail,
  fakeNavigation,
  fakeServices,
  points,
  renderWithServices,
} from './helpers';

const renderDetail = (services: ReturnType<typeof fakeServices>) =>
  renderWithServices(
    <MeetupDetailScreen
      route={{ key: 'd', name: 'MeetupDetail', params: { meetupId: SATURDAY } }}
      navigation={fakeNavigation()}
    />,
    services,
  );

describe('MeetupDetailScreen', () => {
  it('shows a loading state, then title, attendees and the approximate area for a member without RSVP', async () => {
    let resolve!: (d: ReturnType<typeof detail>) => void;
    const pending = new Promise<ReturnType<typeof detail>>((r) => (resolve = r));
    await renderDetail(fakeServices({ meetups: { get: () => pending } }));
    expect(screen.getByTestId('state-loading')).toBeTruthy();
    resolve(detail());
    expect(await screen.findByText('Saturday morning loop')).toBeTruthy();
    expect(screen.getByText('Jordan Price')).toBeTruthy();
    expect(screen.getByText('Riley Chen')).toBeTruthy();
    expect(screen.getByTestId('map-approximate')).toBeTruthy();
    expect(screen.queryByText('North gate, Linden Park')).toBeNull();
    expect(screen.queryByTestId('cancel-button')).toBeNull();
  });

  it('after RSVP, the map switches to the exact point from the server response', async () => {
    const rsvp = jest.fn(async () =>
      detail({
        meetingPoint: points.exact,
        attendeeCount: 3,
        viewer: {
          isCreator: false,
          isAttending: true,
          canRsvp: false,
          canCancel: false,
          canEdit: false,
        },
        attendees: [
          ...detail().attendees,
          { userId: SAM, displayName: 'Sam Okafor', rsvpAt: '2026-10-29T11:00:00.000Z' },
        ],
      }),
    );
    await renderDetail(fakeServices({ meetups: { get: async () => detail(), rsvp } }));

    await fireEvent.press(await screen.findByTestId('rsvp-button'));

    await waitFor(() => expect(screen.getByTestId('map-exact')).toBeTruthy());
    expect(rsvp).toHaveBeenCalledWith(SATURDAY);
    expect(screen.getByTestId('exact-point-info')).toBeTruthy();
    expect(screen.getAllByText('North gate, Linden Park').length).toBeGreaterThan(0);
    expect(screen.getByText(/Sam Okafor/)).toBeTruthy();
    expect(screen.getByTestId('withdraw-button')).toBeTruthy();
    expect(screen.queryByTestId('rsvp-button')).toBeNull();
  });

  it('shows the cancel action only to the creator, behind a confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const creatorView = detail({
      meetingPoint: points.exact,
      viewer: {
        isCreator: true,
        isAttending: false,
        canRsvp: true,
        canCancel: true,
        canEdit: true,
      },
    });
    await renderDetail(fakeServices({ meetups: { get: async () => creatorView } }, AVERY));
    await fireEvent.press(await screen.findByTestId('cancel-button'));
    expect(alert).toHaveBeenCalledWith(
      'Cancel this meetup?',
      expect.any(String),
      expect.any(Array),
      expect.anything(),
    );
    alert.mockRestore();
  });

  it('marks a cancelled meetup and offers no RSVP', async () => {
    await renderDetail(
      fakeServices({
        meetups: {
          get: async () =>
            detail({
              status: 'cancelled',
              cancelledAt: '2026-10-29T12:00:00.000Z',
              viewer: {
                isCreator: false,
                isAttending: false,
                canRsvp: false,
                canCancel: false,
                canEdit: false,
              },
            }),
        },
      }),
    );
    expect(await screen.findByTestId('cancelled-banner')).toBeTruthy();
    expect(screen.queryByTestId('rsvp-button')).toBeNull();
    expect(screen.getByTestId('rsvp-status').props.children).toBe('This meetup is cancelled.');
  });

  it('shows an error state with retry when the meetup cannot be loaded', async () => {
    await renderDetail(
      fakeServices({ meetups: { get: async () => Promise.reject(new Error('Meetup not found')) } }),
    );
    expect(await screen.findByTestId('state-error')).toBeTruthy();
    expect(screen.getByText('Meetup not found')).toBeTruthy();
  });

  it('surfaces a server rejection of an RSVP', async () => {
    const { ApiError } = jest.requireActual('../src/core/api/api-error');
    await renderDetail(
      fakeServices({
        meetups: {
          get: async () => detail(),
          rsvp: async () =>
            Promise.reject(
              new ApiError(
                'MEETUP_STARTED',
                'This meetup has already started and no longer accepts RSVPs',
                409,
              ),
            ),
        },
      }),
    );
    await fireEvent.press(await screen.findByTestId('rsvp-button'));
    expect(
      await screen.findByText('This meetup has already started and no longer accepts RSVPs'),
    ).toBeTruthy();
  });
});
