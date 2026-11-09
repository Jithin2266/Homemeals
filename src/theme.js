// HomeMeal design tokens — warm "Kerala kitchen" palette:
// banana-leaf green, turmeric, cardamom cream, chilli terracotta.
export const colors = {
  bg: '#F7F3EC',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EADF',
  ink: '#1D2A24',
  inkSoft: '#4E5B54',
  muted: '#8A938E',
  line: '#E6DFD3',
  lineStrong: '#D3C9B8',

  primary: '#1F5C46', // banana leaf
  primaryDark: '#163F31',
  primarySoft: '#E3EFE8',
  primaryInk: '#FFFFFF',

  accent: '#E19A2B', // turmeric
  accentSoft: '#FBEFD9',

  danger: '#C4513A', // chilli
  dangerSoft: '#F8E3DD',

  info: '#3F5BA9',
  infoSoft: '#E4E9F6',

  // Meal identity colors
  breakfast: '#D98A1E',
  breakfastSoft: '#FCEFD8',
  lunch: '#2E7D5B',
  lunchSoft: '#E1F0E7',
  dinner: '#5B4B9A',
  dinnerSoft: '#ECE8F6',

  // Purchase status colors (always paired with text + icon — NFR-012)
  pending: '#8A6A12',
  pendingSoft: '#FAF0CF',
  partial: '#3F5BA9',
  partialSoft: '#E4E9F6',
  purchased: '#2E7D5B',
  purchasedSoft: '#E1F0E7',
  cancelled: '#7C7C7C',
  cancelledSoft: '#ECECEC',
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = (n) => n * 4;

export const shadow = {
  card: {
    shadowColor: '#3B2F1C',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  float: {
    shadowColor: '#1D2A24',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

export const MEALS = ['breakfast', 'lunch', 'dinner'];

export const mealMeta = {
  breakfast: { icon: 'sunny-outline', color: colors.breakfast, soft: colors.breakfastSoft, time: '8:00 AM' },
  lunch: { icon: 'partly-sunny-outline', color: colors.lunch, soft: colors.lunchSoft, time: '1:00 PM' },
  dinner: { icon: 'moon-outline', color: colors.dinner, soft: colors.dinnerSoft, time: '8:30 PM' },
};

export const statusMeta = {
  pending: { icon: 'ellipse-outline', color: colors.pending, soft: colors.pendingSoft },
  partial: { icon: 'contrast-outline', color: colors.partial, soft: colors.partialSoft },
  purchased: { icon: 'checkmark-circle', color: colors.purchased, soft: colors.purchasedSoft },
  cancelled: { icon: 'close-circle-outline', color: colors.cancelled, soft: colors.cancelledSoft },
};

export const CATEGORIES = [
  { key: 'vegetables', icon: '🥬' },
  { key: 'fruits', icon: '🍌' },
  { key: 'grains', icon: '🌾' },
  { key: 'pulses', icon: '🫘' },
  { key: 'spices', icon: '🌶️' },
  { key: 'dairy', icon: '🥛' },
  { key: 'meat', icon: '🍗' },
  { key: 'fish', icon: '🐟' },
  { key: 'bakery', icon: '🍞' },
  { key: 'household', icon: '🧴' },
  { key: 'other', icon: '🛒' },
];

export const UNITS = ['kg', 'g', 'litre', 'ml', 'packet', 'nos', 'dozen', 'bunch'];
