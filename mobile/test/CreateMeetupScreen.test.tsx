import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../src/core/api/api-error';
import { CreateMeetupScreen } from '../src/features/meetups/screens/CreateMeetupScreen';
import { MAPLE, detail, fakeNavigation, fakeServices, renderWithServices } from './helpers';

const groups = [{ id: MAPLE, name: 'Maple Street Walkers' }];

const renderCreate = (services: ReturnType<typeof fakeServices>, navigation = fakeNavigation()) =>
  renderWithServices(
    <CreateMeetupScreen
      route={{ key: 'c', name: 'CreateMeetup', params: { groupId: MAPLE } }}
      navigation={navigation}
    />,
    services,
  );

describe('CreateMeetupScreen', () => {
  it('validates with the shared contract before calling the server', async () => {
    const create = jest.fn();
    await renderCreate(
      fakeServices({ groups: { listMine: async () => groups }, meetups: { create } }),
    );
    await fireEvent.press(screen.getByTestId('create-submit'));
    expect(await screen.findByText('Title is required')).toBeTruthy();
    expect(screen.getByText('Meeting point name is required')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it('submits a trimmed, contract-shaped request and opens the new meetup', async () => {
    const create = jest.fn(async () => detail({ id: 'c3000000-0000-4000-8000-0000000000aa' }));
    const navigation = fakeNavigation() as unknown as { replace: jest.Mock };
    await renderCreate(
      fakeServices({ groups: { listMine: async () => groups }, meetups: { create } }),
      navigation as never,
    );

    await fireEvent.changeText(screen.getByTestId('title-input'), '  Evening stroll  ');
    await fireEvent.press(screen.getByTestId('use-spare-place'));
    await fireEvent.press(screen.getByTestId('create-submit'));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const sent = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(sent).toMatchObject({
      groupId: MAPLE,
      title: 'Evening stroll',
      meetingPoint: {
        placeName: 'Fountain plaza, Town Green',
        latitude: 39.999134,
        longitude: -99.999461,
      },
    });
    expect(sent).not.toHaveProperty('createdBy');
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('MeetupDetail', {
        meetupId: 'c3000000-0000-4000-8000-0000000000aa',
        flash: 'created',
      }),
    );
  });

  it('shows server validation errors next to the fields', async () => {
    const create = jest.fn(async () =>
      Promise.reject(
        new ApiError('VALIDATION_FAILED', 'Invalid meetup', 400, [
          { path: 'startsAt', message: 'Start time must be in the future' },
        ]),
      ),
    );
    await renderCreate(
      fakeServices({ groups: { listMine: async () => groups }, meetups: { create } }),
    );
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Evening stroll');
    await fireEvent.press(screen.getByTestId('use-spare-place'));
    await fireEvent.press(screen.getByTestId('create-submit'));
    expect(await screen.findByText('Start time must be in the future')).toBeTruthy();
    expect(screen.getByTestId('create-error')).toBeTruthy();
  });

  it('rejects out-of-range coordinates typed by hand', async () => {
    const create = jest.fn();
    await renderCreate(
      fakeServices({ groups: { listMine: async () => groups }, meetups: { create } }),
    );
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Evening stroll');
    await fireEvent.changeText(screen.getByTestId('place-input'), 'Somewhere');
    await fireEvent.changeText(screen.getByTestId('lat-input'), '123');
    await fireEvent.changeText(screen.getByTestId('lng-input'), '-99.9');
    await fireEvent.press(screen.getByTestId('create-submit'));
    expect(await screen.findByText('Latitude must be between -90 and 90')).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });
});
