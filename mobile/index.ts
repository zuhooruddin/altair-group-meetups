import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import * as NativeSplashScreen from 'expo-splash-screen';
import App from './src/App';

// Expo hides the native launch screen automatically when the first app view is ready.
NativeSplashScreen.setOptions({ duration: 250, fade: true });
registerRootComponent(App);
