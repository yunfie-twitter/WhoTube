import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { approveIndieAuth } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { ShieldCheck, ShieldAlert, ExternalLink, User } from 'lucide-react';
import { cn } from '../lib/utils';

export function IndieAuthPage() {
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = searchParams.get('me');
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope');
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method');

  // Try to extract a friendly name from client_id (which is a URL)
  const clientName = clientId ? new URL(clientId).hostname : 'Unknown Application';

  const handleApprove = async () => {
    if (!me || !clientId || !redirectUri) return;
    
    setLoading(true);
    setError(null);
    try {
      const { code } = await approveIndieAuth({
        me,
        client_id: clientId,
        redirect_uri: redirectUri,
        state: state || undefined,
        scope: scope || undefined,
        code_challenge: codeChallenge || undefined,
        code_challenge_method: codeChallengeMethod || undefined
      });

      // Redirect back to the client
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', code);
      if (state) callbackUrl.searchParams.set('state', state);
      
      window.location.href = callbackUrl.toString();
    } catch (err: any) {
      setError(err.message || 'Approval failed');
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (redirectUri) {
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('error', 'access_denied');
      if (state) callbackUrl.searchParams.set('state', state);
      window.location.href = callbackUrl.toString();
    } else {
      window.history.back();
    }
  };

  if (!me || !clientId || !redirectUri) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-zinc-900">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-bold">Invalid Request</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Missing required IndieAuth parameters.</p>
          <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated && !auth.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-zinc-900">
          <User className="mx-auto h-12 w-12 text-zinc-400" />
          <h1 className="text-2xl font-bold">Login Required</h1>
          <p className="text-zinc-500 dark:text-zinc-400">You need to be logged in to WhoTube to authorize third-party applications.</p>
          <Button className="w-full" onClick={() => auth.signIn()}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transition-all dark:bg-zinc-900">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-center text-white">
          <ShieldCheck className="mx-auto mb-4 h-16 w-16 opacity-90" />
          <h1 className="text-2xl font-extrabold tracking-tight">Authorize Application</h1>
          <p className="mt-2 text-indigo-100 opacity-80">IndieAuth Login</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Application</div>
            <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-zinc-800">
                <ExternalLink className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="font-bold text-zinc-900 dark:text-white">{clientName}</div>
                <div className="text-xs text-zinc-500 truncate max-w-[200px]">{clientId}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Identity</div>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-200 p-4 dark:border-zinc-700">
              <User className="h-5 w-5 text-zinc-400" />
              <div className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{me}</div>
            </div>
          </div>

          {scope && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Permissions</div>
              <div className="flex flex-wrap gap-2">
                {scope.split(' ').map(s => (
                  <span key={s} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleDeny}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-indigo-600 hover:bg-indigo-700" 
              onClick={handleApprove}
              loading={loading}
            >
              Authorize
            </Button>
          </div>

          <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
            By clicking Authorize, you allow this application to identify you as {me}.
          </p>
        </div>
      </div>
    </div>
  );
}
