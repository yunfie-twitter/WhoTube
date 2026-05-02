import { useState } from 'react';
import { cn } from '../lib/utils';
import {
  getDefaultQuality,
  getHideComments,
  getPreferredCodec,
  getRegion,
  preferredCodecs,
  regions,
  setDefaultQuality,
  setHideComments,
  setPreferredCodec,
  setRegion,
  type PreferredCodec,
  getAlwaysLoop,
  setAlwaysLoop,
  getShowEndscreen,
  setShowEndscreen,
  getUseProxy,
  setUseProxy,
  isProxyMandatory,
  getInitialPlaybackRate,
  setInitialPlaybackRate,
  getVolume,
  setVolume,
  getShowRelated,
  setShowRelated,
  getSavePosition,
  setSavePosition,
  getTheme,
  setTheme,
  type Theme,
  getHideEmbedIcon,
  setHideEmbedIcon,
  getHideEmbedInfo,
  setHideEmbedInfo,
  getDefaultHomeCategory,
  setDefaultHomeCategory
} from '../lib/settings';
import { categories } from './home-page';

export function SettingsPage() {
  const [selectedRegion, setSelectedRegion] = useState(() => getRegion());
  const [quality, setQuality] = useState(() => getDefaultQuality());
  const [codec, setCodec] = useState<PreferredCodec>(() => getPreferredCodec());
  const [hideComments, setHideCommentsState] = useState(() => getHideComments());
  
  // New settings states
  const [alwaysLoop, setAlwaysLoopState] = useState(() => getAlwaysLoop());
  const [showEndscreen, setShowEndscreenState] = useState(() => getShowEndscreen());
  const [useProxy, setUseProxyState] = useState(() => getUseProxy());
  const [playbackRate, setPlaybackRate] = useState(() => getInitialPlaybackRate());
  const [volume, setVolumeState] = useState(() => getVolume());
  const [showRelated, setShowRelatedState] = useState(() => getShowRelated());
  const [savePosition, setSavePositionState] = useState(() => getSavePosition());
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const [hideEmbedIcon, setHideEmbedIconState] = useState(() => getHideEmbedIcon());
  const [hideEmbedInfo, setHideEmbedInfoState] = useState(() => getHideEmbedInfo());
  const [defaultHomeCategory, setDefaultHomeCategoryState] = useState(() => getDefaultHomeCategory());

  const proxyMandatory = isProxyMandatory();

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-12 pr-4 pl-4 transition-colors duration-300">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">設定</h1>

      {/* 外観設定 */}
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818] transition-colors">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">テーマ</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">アプリの見た目を変更します。</p>
        </div>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setThemeState(t);
                setTheme(t);
              }}
              className={theme === t 
                ? 'flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-zinc-950 transition-all' 
                : 'flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-200 dark:bg-[#0f0f0f] dark:text-zinc-100 dark:hover:bg-zinc-800 transition-all'}
            >
              {t === 'dark' ? 'ダーク' : t === 'light' ? 'ライト' : 'システム'}
            </button>
          ))}
        </div>
      </section>

      {/* プレイヤー設定 */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818]">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">再生速度 (初期値)</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">動画開始時の速度です。</p>
          </div>
          <select
            value={playbackRate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setPlaybackRate(val);
              setInitialPlaybackRate(val);
            }}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-zinc-500 transition-colors"
          >
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
              <option key={r} value={r}>{r}x</option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818]">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">デフォルト音量</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">最後に設定した音量: {Math.round(volume * 100)}%</p>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolumeState(val);
              setVolume(val);
            }}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-700 accent-red-600"
          />
        </div>
      </section>

      {/* トグル設定 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleButton
          label="常にループ再生"
          description="動画終了時に自動で最初から再生します。"
          value={alwaysLoop}
          onChange={(v) => { setAlwaysLoopState(v); setAlwaysLoop(v); }}
        />
        <ToggleButton
          label="おすすめ動画を表示"
          description="再生終了後に画面上に関連動画を表示します。"
          value={showEndscreen}
          onChange={(v) => { setShowEndscreenState(v); setShowEndscreen(v); }}
        />
        <ToggleButton
          label="再生位置を保存"
          description="動画の途中から再開できるようにします。"
          value={savePosition}
          onChange={(v) => { setSavePositionState(v); setSavePosition(v); }}
        />
        <ToggleButton
          label="関連動画をサイドバーに表示"
          description="視聴ページのおすすめ一覧を表示します。"
          value={showRelated}
          onChange={(v) => { setShowRelatedState(v); setShowRelated(v); }}
        />
        <ToggleButton
          label="プロキシを経由"
          description={proxyMandatory ? "現在のネットワーク環境では必須です。" : "ストリーミングを WhoTube 経由で行います。"}
          value={useProxy}
          disabled={proxyMandatory}
          onChange={(v) => { setUseProxyState(v); setUseProxy(v); }}
        />
        <ToggleButton
          label="コメント欄を非表示"
          description="動画ページでコメントを表示しません。"
          value={hideComments}
          onChange={(v) => { setHideCommentsState(v); setHideComments(v); }}
        />
        <ToggleButton
          label="埋め込みアイコンを非表示"
          description="埋め込みプレイヤーのロゴアイコンを非表示にします。"
          value={hideEmbedIcon}
          onChange={(v) => { setHideEmbedIconState(v); setHideEmbedIcon(v); }}
        />
        <ToggleButton
          label="埋め込み情報を非表示"
          description="埋め込みプレイヤーのタイトルと投稿者を非表示にします。"
          value={hideEmbedInfo}
          onChange={(v) => { setHideEmbedInfoState(v); setHideEmbedInfo(v); }}
        />
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818]">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">地域</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">ホーム画面のおすすめ内容に反映されます。</p>
        </div>
        <select
          value={selectedRegion}
          onChange={(event) => {
            setSelectedRegion(event.target.value);
            setRegion(event.target.value);
          }}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-zinc-500 transition-colors"
        >
          {regions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818]">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">既定画質</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">動画開始時に優先する垂直解像度です。</p>
        </div>
        <select
          value={quality}
          onChange={(event) => {
            setQuality(event.target.value);
            setDefaultQuality(event.target.value);
          }}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-zinc-500 transition-colors"
        >
          <option value="auto">自動</option>
          <option value="2160">2160p (4K)</option>
          <option value="1440">1440p (QHD)</option>
          <option value="1080">1080p (FHD)</option>
          <option value="720">720p (HD)</option>
          <option value="480">480p</option>
          <option value="360">360p</option>
        </select>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818]">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">優先コーデック</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">デバイスが対応している場合に優先されます。</p>
        </div>
        <select
          value={codec}
          onChange={(event) => {
            const next = event.target.value as PreferredCodec;
            setCodec(next);
            setPreferredCodec(next);
          }}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-zinc-500 transition-colors"
        >
          {preferredCodecs.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818]">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">ホームの既定カテゴリ</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">アプリ起動時に最初に表示されるカテゴリです。</p>
        </div>
        <select
          value={defaultHomeCategory}
          onChange={(event) => {
            const next = event.target.value;
            setDefaultHomeCategoryState(next);
            setDefaultHomeCategory(next);
          }}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-[#0f0f0f] dark:text-white dark:focus:border-zinc-500 transition-colors"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}

function ToggleButton({ label, description, value, onChange, disabled }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <section className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#181818] transition-colors">
      <div className="min-w-0 flex-1">
        <h2 className={disabled ? "text-base font-bold text-zinc-400" : "text-base font-bold text-zinc-900 dark:text-white"}>{label}</h2>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={cn(
          'h-6 w-11 shrink-0 rounded-full p-1 transition-all duration-200 disabled:opacity-50',
          value ? 'bg-red-600' : 'bg-zinc-200 dark:bg-zinc-700'
        )}
        aria-pressed={value}
      >
        <span className={cn(
          'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          value ? 'translate-x-5' : 'translate-x-0'
        )} />
      </button>
    </section>
  );
}
