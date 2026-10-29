import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  SignIn: undefined;
  Meetups: undefined;
  MeetupDetail: { meetupId: string; flash?: 'created' | 'updated' };
  CreateMeetup: { groupId: string };
  EditMeetup: { meetupId: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;
