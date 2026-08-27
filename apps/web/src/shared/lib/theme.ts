export type AptoraTheme = 'default' | 'contrast' | 'vivid' | 'electric';

export const THEME_KEY = 'aptora_theme';

export const THEME_OPTIONS: { id: AptoraTheme; label: string; hint: string }[] = [
  { id: 'default', label: 'Default', hint: 'Balanced ledger light' },
  { id: 'contrast', label: 'High contrast', hint: 'Sharper text and borders' },
  { id: 'vivid', label: 'Vivid', hint: 'Richer brand color overlays' },
  {
    id: 'electric',
    label: 'Electric',
    hint: 'Bold violet-magenta — saturated, focused accents',
  },
];

export function getTheme(): AptoraTheme {
  const stored = localStorage.getItem(THEME_KEY);
  if (
    stored === 'contrast' ||
    stored === 'vivid' ||
    stored === 'electric' ||
    stored === 'default'
  ) {
    return stored;
  }
  return 'default';
}

export function setTheme(theme: AptoraTheme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: AptoraTheme = getTheme()) {
  document.documentElement.dataset.aptoraTheme = theme;
}
