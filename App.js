import React, { useState } from 'react';
import { ActivityIndicator, Platform, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { FONTS } from './src/fonts';
import { StoreProvider, useStore } from './src/store';
import { FeedbackProvider } from './src/ui';
import { BurstProvider, Splash } from './src/motion';
import { NavProvider } from './src/nav';
import NotificationAgent from './src/NotificationAgent';
import { colors } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import PlannerScreen from './src/screens/PlannerScreen';
import GroceryScreen from './src/screens/GroceryScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import MoreScreen from './src/screens/MoreScreen';
import WeeksScreen from './src/screens/WeeksScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import ShoppingScreen from './src/screens/ShoppingScreen';
import MembersScreen from './src/screens/MembersScreen';
import DataScreen from './src/screens/DataScreen';

const TABS = [
  { key: 'home', icon: 'home-outline', iconOn: 'home' },
  { key: 'plan', icon: 'calendar-outline', iconOn: 'calendar' },
  { key: 'grocery', icon: 'basket-outline', iconOn: 'basket' },
  { key: 'activity', icon: 'notifications-outline', iconOn: 'notifications' },
  { key: 'more', icon: 'person-circle-outline', iconOn: 'person-circle' },
];

const SCREENS = {
  home: HomeScreen, plan: PlannerScreen, grocery: GroceryScreen, activity: ActivityScreen, more: MoreScreen,
  weeks: WeeksScreen, preview: PreviewScreen, shopping: ShoppingScreen, members: MembersScreen, data: DataScreen,
};

function Root() {
  const { ready, me, t, isCreator, unreadCount, data, online, cloudState, sessionId } = useStore();
  const loading = (text) => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: 14 }}>
      <ActivityIndicator color={colors.primary} size="large" />
      {text ? <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.inkSoft, fontSize: 15 }}>{text}</Text> : null}
    </View>
  );
  if (!ready || (online && cloudState === 'starting')) return loading();
  // Signed in online, household still downloading (e.g. first sign-in on a new phone)
  if (!me && online && sessionId && cloudState === 'connecting') return loading('Loading your household…');
  if (!me) return <AuthFlow />;
  const toBuy = data.groceries.filter((g) => g.status === 'pending' || g.status === 'partial').length;
  return (
    <NavProvider
      key={me.id}
      tabs={TABS}
      screens={SCREENS}
      tabBarLabels={(k) => (k === 'plan' ? (isCreator ? t('plan') : t('meals')) : t(k))}
      badgeFor={(k) => (k === 'activity' ? unreadCount : k === 'grocery' && !isCreator ? toBuy : 0)}
    >
      <NotificationAgent />
    </NavProvider>
  );
}

function AuthFlow() {
  const [reg, setReg] = useState(null); // null = login, { role } = register
  if (reg) return <RegisterScreen initialRole={reg.role} onBack={() => setReg(null)} />;
  return <LoginScreen onRegister={(role) => setReg({ role })} />;
}

// On wide web screens, present the app inside a phone-sized frame.
function Frame({ children }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < 640) return <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>;
  const h = Math.min(height - 40, 880);
  return (
    <View style={{ flex: 1, backgroundColor: '#E9E2D4', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 400, height: h, borderRadius: 44, overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 10, borderColor: '#1D2A24', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, transform: [{ translateZ: 0 }] }}>
        {children}
      </View>
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts(FONTS);
  const [splash, setSplash] = useState(true);
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Frame>
        <StoreProvider>
          <FeedbackProvider>
            <BurstProvider>
              <Root />
              {splash ? <Splash onDone={() => setSplash(false)} /> : null}
            </BurstProvider>
          </FeedbackProvider>
        </StoreProvider>
      </Frame>
    </SafeAreaProvider>
  );
}
