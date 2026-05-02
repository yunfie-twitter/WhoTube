import { cn } from '../../lib/utils';

interface WatchSkeletonProps {
  isTheaterMode: boolean;
}

export function WatchSkeleton({ isTheaterMode }: WatchSkeletonProps) {
  return (
    <div className="mx-auto w-full max-w-[2200px] animate-pulse p-0 lg:px-6 lg:pt-4 bg-zinc-50 dark:bg-[#0f0f0f] min-h-screen">
      <div className={cn("grid gap-6", !isTheaterMode && "lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_400px]")}>
        <div className="flex flex-col gap-4">
          <div className={cn("aspect-video w-full bg-zinc-200 dark:bg-zinc-800", !isTheaterMode && "md:rounded-xl")} />
          <div className="flex flex-col gap-3 px-4 md:px-0">
            <div className="h-6 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col gap-2">
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="mt-4 h-24 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
        {!isTheaterMode && (
          <div className="flex flex-col gap-4 px-4 md:px-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="aspect-video w-40 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
