// LIVE by default (the installable app): starts empty, no demo accounts.
// The web preview is built with EXPO_PUBLIC_DEMO_MODE=1 to show sample data.
export const DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === '1';
export const DEMO_HOUSEHOLD_ID = 'hh1';
export const DEMO_USER_IDS = ['u1', 'u2', 'u3', 'u4'];
