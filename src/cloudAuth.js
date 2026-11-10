// Phones: keep the Firebase sign-in between app launches.
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const makeAuth = (app) => initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
