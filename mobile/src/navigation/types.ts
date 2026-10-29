import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  SignIn: undefined;
  Meetups: undefined;
  MeetupDetail: { meetupId: string; flash?: 'created' };
  CreateMeetup: { groupId: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;
