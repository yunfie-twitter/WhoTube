export const REGION_STORAGE_KEY = 'whotube:region';
export const DEFAULT_QUALITY_STORAGE_KEY = 'whotube:default-quality';
export const PREFERRED_CODEC_STORAGE_KEY = 'whotube:preferred-codec';
export const HIDE_COMMENTS_STORAGE_KEY = 'whotube:hide-comments';
export const ALWAYS_LOOP_STORAGE_KEY = 'whotube:always-loop';
export const SHOW_ENDSCREEN_STORAGE_KEY = 'whotube:show-endscreen';
export const USE_PROXY_STORAGE_KEY = 'whotube:use-proxy';
export const INITIAL_PLAYBACK_RATE_STORAGE_KEY = 'whotube:initial-playback-rate';
export const VOLUME_STORAGE_KEY = 'whotube:player-volume';
export const SHOW_RELATED_STORAGE_KEY = 'whotube:show-related';
export const SAVE_POSITION_STORAGE_KEY = 'whotube:save-position';
export const THEME_STORAGE_KEY = 'whotube:theme';
export const HIDE_EMBED_ICON_STORAGE_KEY = 'whotube:hide-embed-icon';
export const HIDE_EMBED_INFO_STORAGE_KEY = 'whotube:hide-embed-info';
export const DEFAULT_HOME_CATEGORY_STORAGE_KEY = 'whotube:default-home-category';

export const regions = [
  { code: 'JP', label: '日本' },
  { code: 'US', label: 'アメリカ' },
  { code: 'KR', label: '韓国' },
  { code: 'GB', label: 'イギリス' },
  { code: 'TW', label: '台湾' },
  { code: 'IN', label: 'インド' }
];

export function getRegion() {
  return window.localStorage.getItem(REGION_STORAGE_KEY) || 'JP';
}

export function setRegion(region: string) {
  window.localStorage.setItem(REGION_STORAGE_KEY, region);
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getRegionLabel(region: string) {
  return regions.find((item) => item.code === region)?.label ?? region;
}

export function getDefaultQuality() {
  return window.localStorage.getItem(DEFAULT_QUALITY_STORAGE_KEY) || 'auto';
}

export function setDefaultQuality(quality: string) {
  window.localStorage.setItem(DEFAULT_QUALITY_STORAGE_KEY, quality);
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export type PreferredCodec = 'auto' | 'av1' | 'vp9' | 'avc1';

export const preferredCodecs: Array<{ value: PreferredCodec; label: string }> = [
  { value: 'auto', label: '自動' },
  { value: 'av1', label: 'AV1' },
  { value: 'vp9', label: 'VP9' },
  { value: 'avc1', label: 'H.264 / AVC' }
];

export function getPreferredCodec(): PreferredCodec {
  const value = window.localStorage.getItem(PREFERRED_CODEC_STORAGE_KEY);
  return value === 'av1' || value === 'vp9' || value === 'avc1' ? value : 'auto';
}

export function setPreferredCodec(codec: PreferredCodec) {
  window.localStorage.setItem(PREFERRED_CODEC_STORAGE_KEY, codec);
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getHideComments() {
  return window.localStorage.getItem(HIDE_COMMENTS_STORAGE_KEY) === '1';
}

export function setHideComments(hidden: boolean) {
  window.localStorage.setItem(HIDE_COMMENTS_STORAGE_KEY, hidden ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

// --- New Settings ---

export function getAlwaysLoop() {
  return window.localStorage.getItem(ALWAYS_LOOP_STORAGE_KEY) === '1';
}

export function setAlwaysLoop(value: boolean) {
  window.localStorage.setItem(ALWAYS_LOOP_STORAGE_KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getShowEndscreen() {
  const value = window.localStorage.getItem(SHOW_ENDSCREEN_STORAGE_KEY);
  return value === null ? true : value === '1';
}

export function setShowEndscreen(value: boolean) {
  window.localStorage.setItem(SHOW_ENDSCREEN_STORAGE_KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getUseProxy() {
  const value = window.localStorage.getItem(USE_PROXY_STORAGE_KEY);
  // デフォルトオン
  if (value === null) return true;
  // オフにできない条件（localhost などの場合）
  if (isProxyMandatory() && value === '0') return true;
  return value === '1';
}

export function setUseProxy(value: boolean) {
  window.localStorage.setItem(USE_PROXY_STORAGE_KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function isProxyMandatory() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
}

export function getInitialPlaybackRate() {
  const value = window.localStorage.getItem(INITIAL_PLAYBACK_RATE_STORAGE_KEY);
  return value ? parseFloat(value) : 1.0;
}

export function setInitialPlaybackRate(rate: number) {
  window.localStorage.setItem(INITIAL_PLAYBACK_RATE_STORAGE_KEY, String(rate));
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getVolume() {
  const value = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  return value ? parseFloat(value) : 1.0;
}

export function setVolume(volume: number) {
  window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
  // 静かに更新（イベントは発行しないことが多いが、一応発行する）
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getShowRelated() {
  const value = window.localStorage.getItem(SHOW_RELATED_STORAGE_KEY);
  return value === null ? true : value === '1';
}

export function setShowRelated(value: boolean) {
  window.localStorage.setItem(SHOW_RELATED_STORAGE_KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getSavePosition() {
  const value = window.localStorage.getItem(SAVE_POSITION_STORAGE_KEY);
  return value === null ? true : value === '1';
}

export function setSavePosition(value: boolean) {
  window.localStorage.setItem(SAVE_POSITION_STORAGE_KEY, value ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export type Theme = 'dark' | 'light' | 'system';

export function getTheme(): Theme {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme;
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'dark'; // デフォルトダーク
}

export function setTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let actualTheme = theme;
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  if (actualTheme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export function getHideEmbedIcon() {
  return window.localStorage.getItem(HIDE_EMBED_ICON_STORAGE_KEY) === '1';
}

export function setHideEmbedIcon(hidden: boolean) {
  window.localStorage.setItem(HIDE_EMBED_ICON_STORAGE_KEY, hidden ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getHideEmbedInfo() {
  return window.localStorage.getItem(HIDE_EMBED_INFO_STORAGE_KEY) === '1';
}

export function setHideEmbedInfo(hidden: boolean) {
  window.localStorage.setItem(HIDE_EMBED_INFO_STORAGE_KEY, hidden ? '1' : '0');
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}

export function getDefaultHomeCategory() {
  return window.localStorage.getItem(DEFAULT_HOME_CATEGORY_STORAGE_KEY) || 'すべて';
}

export function setDefaultHomeCategory(category: string) {
  window.localStorage.setItem(DEFAULT_HOME_CATEGORY_STORAGE_KEY, category);
  window.dispatchEvent(new CustomEvent('whotube:settings-changed'));
}
