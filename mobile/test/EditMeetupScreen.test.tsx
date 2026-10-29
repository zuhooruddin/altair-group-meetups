import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { EditMeetupScreen } from '../src/features/meetups/screens/EditMeetupScreen';
import {
  AVERY,
  SATURDAY,
  detail,
  fakeNavigation,
  fakeServices,
  points,
  renderWithServices,
} from './helpers';

const creatorView = () =>
  detail({
    meetingPoint: points.exact,
    viewer: { isCreator: true, isAttending: false, canRsvp: true, canCancel: true, canEdit: true },
  });

const renderEdit = (services: ReturnType<typeof fakeServices>, navigation = fakeNavigation()) =>
  renderWithServices(
    <EditMeetupScreen
      route={{ key: 'e', name: 'EditMeetup', params: { meetupId: SATURDAY } }}
      navigation={navigation}
    />,
    services,
  );

describe('EditMeetupScreen (bonus)', () => {
  it('prefills the current values', async () => {
    await renderEdit(fakeServices({ meetups: { get: async () => creatorView() } }, AVERY));
    expect((await screen.findByTestId('title-input')).props.value).toBe('Saturday morning loop');
    expect(screen.getByTestId('place-input').props.value).toBe('North gate, Linden Park');
    expect(screen.getByTestId('lat-input').props.value).toBe('40.012046');
    expect(screen.getByTestId('lng-input').props.value).toBe('-99.984517');
  });

  it('sends only what changed and returns to the detail with a confirmation', async () => {
    const update = jest.fn(async () => creatorView());
    const navigation = fakeNavigation() as unknown as { popTo: jest.Mock };
    navigation.popTo = jest.fn();
    await renderEdit(
      fakeServices({ meetups: { get: async () => creatorView(), update } }, AVERY),
      navigation as never,
    );
    await fireEvent.changeText(await screen.findByTestId('title-input'), ' Sunday loop ');
    await fireEvent.press(screen.getByTestId('edit-submit'));
    await waitFor(() => expect(update).toHaveBeenCalledWith(SATURDAY, { title: 'Sunday loop' }));
    expect(navigation.popTo).toHaveBeenCalledWith('MeetupDetail', {
      meetupId: SATURDAY,
      flash: 'updated',
    });
  });

  it('validates with the shared schema before sending', async () => {
    const update = jest.fn();
    await renderEdit(fakeServices({ meetups: { get: async () => creatorView(), update } }, AVERY));
    await fireEvent.changeText(await screen.findByTestId('title-input'), '   ');
    await fireEvent.press(screen.getByTestId('edit-submit'));
    expect(await screen.findByText('Title is required')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not offer the form to a non-creator', async () => {
    await renderEdit(fakeServices({ meetups: { get: async () => detail() } }));
    expect(await screen.findByText('Only the host can edit a scheduled meetup.')).toBeTruthy();
    expect(screen.queryByTestId('edit-submit')).toBeNull();
  });
});
