import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router-dom';
import { logtoConfig } from '../lib/logto';

export function CallbackPage() {
  if (!logtoConfig) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-100">
        <p className="text-sm text-zinc-400">Logto が設定されていません。</p>
      </div>
    );
  }

  return <LogtoCallbackPage />;
}

function LogtoCallbackPage() {
  const navigate = useNavigate();
  const { isLoading, error } = useHandleSignInCallback(() => {
    navigate('/', { replace: true });
  });

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-zinc-100">
      <div className="text-center">
        <p className="text-base font-semibold">{error ? 'サインインに失敗しました' : 'サインイン中...'}</p>
        {isLoading ? <p className="mt-2 text-sm text-zinc-400">Logto から戻っています。</p> : null}
        {error ? <p className="mt-2 text-sm text-red-300">{error.message}</p> : null}
      </div>
    </div>
  );
}
