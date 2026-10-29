import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/AuthProvider';
import { SignInScreen } from '../features/auth/SignInScreen';
import { CreateMeetupScreen } from '../features/meetups/screens/CreateMeetupScreen';
import { EditMeetupScreen } from '../features/meetups/screens/EditMeetupScreen';
import { MeetupDetailScreen } from '../features/meetups/screens/MeetupDetailScreen';
import { MeetupListScreen } from '../features/meetups/screens/MeetupListScreen';
import { LoadingState } from '../ui/StateViews';
import { colors } from '../ui/theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export function RootNavigator() {
  const { state } = useAuth();
  if (state.status === 'loading') return <LoadingState message="Starting…" />;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {state.status === 'signedOut' ? (
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="Meetups"
              component={MeetupListScreen}
              options={{ title: 'Group meetups' }}
            />
            <Stack.Screen
              name="MeetupDetail"
              component={MeetupDetailScreen}
              options={{ title: 'Meetup' }}
            />
            <Stack.Screen
              name="CreateMeetup"
              component={CreateMeetupScreen}
              options={{ title: 'New meetup', presentation: 'modal' }}
            />
            <Stack.Screen
              name="EditMeetup"
              component={EditMeetupScreen}
              options={{ title: 'Edit meetup', presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
