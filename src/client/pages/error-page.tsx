import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Clock3,
  Home,
  Lock,
  RotateCcw,
  SearchX,
  ServerCrash,
  ShieldAlert,
  WifiOff
} from 'lucide-react';
import { Button } from '../components/ui/button';

type ErrorType =
  | 'not-found'
  | 'server'
  | 'offline'
  | 'network'
  | 'playback'
  | 'unavailable'
  | 'forbidden'
  | 'timeout'
  | 'unknown';

const errorPages: Record<ErrorType, {
  code: string;
  title: string;
  message: string;
  icon: typeof AlertTriangle;
}> = {
  'not-found': {
    code: '404',
    title: 'ページが見つかりません',
    message: 'URLが変わったか、動画やチャンネルが利用できなくなっている可能性があります。',
    icon: SearchX
  },
  server: {
    code: '500',
    title: 'サーバーで問題が発生しました',
    message: '少し時間を置いてからもう一度試してください。',
    icon: ServerCrash
  },
  offline: {
    code: 'OFFLINE',
    title: 'オフラインです',
    message: 'ネットワーク接続を確認してください。保存済みの動画は再生リストから確認できます。',
    icon: WifiOff
  },
  network: {
    code: 'NETWORK',
    title: '通信に失敗しました',
    message: 'YouTubeへの接続、または画像・動画プロキシへの接続に失敗しました。',
    icon: WifiOff
  },
  playback: {
    code: 'PLAYBACK',
    title: '再生できませんでした',
    message: '別の画質を選ぶか、ページを更新してもう一度再生してください。',
    icon: AlertTriangle
  },
  unavailable: {
    code: 'UNAVAILABLE',
    title: 'コンテンツを読み込めません',
    message: '動画、チャンネル、再生リストが非公開または削除されている可能性があります。',
    icon: ShieldAlert
  },
  forbidden: {
    code: '403',
    title: 'アクセスできません',
    message: 'このコンテンツを表示する権限がないか、地域設定により制限されています。',
    icon: Lock
  },
  timeout: {
    code: 'TIMEOUT',
    title: '読み込みに時間がかかっています',
    message: '接続が混み合っている可能性があります。再読み込みを試してください。',
    icon: Clock3
  },
  unknown: {
    code: 'ERROR',
    title: '予期しない問題が発生しました',
    message: '操作をやり直しても解決しない場合は、ホームに戻ってください。',
    icon: AlertTriangle
  }
};

const routeAliases: Record<string, ErrorType> = {
  '404': 'not-found',
  'not-found': 'not-found',
  '500': 'server',
  server: 'server',
  offline: 'offline',
  network: 'network',
  'network-error': 'network',
  playback: 'playback',
  'playback-error': 'playback',
  unavailable: 'unavailable',
  forbidden: 'forbidden',
  timeout: 'timeout'
};

interface ErrorPageProps {
  type?: ErrorType;
  title?: string;
  message?: string;
}

export function ErrorPage({ type = 'unknown', title, message }: ErrorPageProps) {
  const config = errorPages[type] ?? errorPages.unknown;
  const Icon = config.icon;

  return (
    <div className="flex min-h-[calc(100vh-96px)] items-center justify-center px-4 py-10 text-zinc-100">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#272727] text-red-500 ring-1 ring-white/10">
          <Icon size={40} />
        </div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.24em] text-zinc-500">{config.code}</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{title ?? config.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-400">{message ?? config.message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="gap-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-200">
            <Link to="/">
              <Home size={18} />
              ホーム
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2 rounded-full bg-[#272727] text-white hover:bg-[#3a3a3a]"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={18} />
            再読み込み
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ErrorRoutePage() {
  const { type = 'unknown' } = useParams();
  return <ErrorPage type={routeAliases[type] ?? 'unknown'} />;
}
