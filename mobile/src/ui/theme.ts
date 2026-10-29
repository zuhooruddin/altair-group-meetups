export const colors = {
  primary: '#1F4D3A', // deep forest green
  primaryPressed: '#173B2C',
  secondary: '#DCE7D8', // soft sage
  secondaryStrong: '#A8BFA3',
  accent: '#2F7F7A', // muted teal
  accentSoft: 'rgba(47, 127, 122, 0.16)',
  background: '#F7F5EF', // warm off-white
  surface: '#FFFFFF',
  text: '#22272B', // dark charcoal
  textMuted: '#5E676E',
  border: '#E3E0D6',
  danger: '#B3412E',
  dangerSoft: '#F7E2DD',
  warning: '#8A5A00',
  warningSoft: '#F6E7C8',
  success: '#2E6B3F',
  successSoft: '#DDEEDC',
  onPrimary: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

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
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
