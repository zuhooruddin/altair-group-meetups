export const colors = {
  primary: '#005B43', // deep emerald
  primaryPressed: '#003E2E',
  secondary: '#E2F2EA', // soft mint
  secondaryStrong: '#B8D8C9',
  accent: '#2F7F7A', // muted teal
  accentSoft: 'rgba(47, 127, 122, 0.16)',
  background: '#FAF8F1', // warm ivory
  surface: '#FFFFFF',
  text: '#17231F',
  textMuted: '#63706C',
  border: '#E9E8E0',
  danger: '#B3412E',
  dangerSoft: '#F7E2DD',
  warning: '#BA392F',
  warningSoft: '#FFE6E0',
  success: '#2E6B3F',
  successSoft: '#DDEEDC',
  onPrimary: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700' as const },
  heading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

export const shadow = {
  shadowColor: '#1F2A24',
  shadowOpacity: 0.045,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
