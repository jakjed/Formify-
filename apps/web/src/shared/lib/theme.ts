export type AppTheme = 'default' | 'contrast' | 'vivid' | 'electric' | 'forge';

export const THEME_KEY = 'procure_ledger_theme';

export const THEME_OPTIONS: { id: AppTheme; label: string; hint: string }[] = [
  { id: 'default', label: 'Default', hint: 'Balanced ledger light' },
  { id: 'contrast', label: 'High contrast', hint: 'Sharper text and borders' },
  { id: 'vivid', label: 'Vivid', hint: 'Richer brand color overlays' },
  {
    id: 'electric',
    label: 'Electric',
    hint: 'Bold violet-magenta — saturated, focused accents',
  },
  {
    id: 'forge',
    label: 'Forge',
    hint: 'Steel & cobalt fire — industrial, high-voltage',
  },
];

export function getTheme(): AppTheme {
  const stored =
    localStorage.getItem(THEME_KEY) ?? localStorage.getItem('aptora_theme');
  if (
    stored === 'contrast' ||
    stored === 'vivid' ||
    stored === 'electric' ||
    stored === 'forge' ||
    stored === 'default'
  ) {
    return stored;
  }
  return 'default';
}

export function setTheme(theme: AppTheme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: AppTheme = getTheme()) {
  document.documentElement.dataset.plTheme = theme;
}
