import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import type { VideoItem } from '../../lib/types';
import { addHistoryItem } from '../../lib/history';
import { ChannelAvatar } from './channel-avatar';
import { proxyImageUrl } from '../../lib/images';

interface Props {
  items: VideoItem[];
  hideChannel?: boolean;
  onVideoClick?: (video: VideoItem) => void;
}

function markAutoplayIntent() {
  window.sessionStorage.setItem('whotube:autoplay-with-sound', '1');
}

function rememberWatchedVideo(video: VideoItem) {
  addHistoryItem(video);
}

export function VideoGrid({ items, hideChannel = false, onVideoClick }: Props) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {items.map((video) => (
        <div
          key={`${video.id}-${video.title}`}
          role="link"
          tabIndex={0}
          onClick={() => {
            markAutoplayIntent();
            rememberWatchedVideo(video);
            if (onVideoClick) {
              onVideoClick(video);
            } else {
              const path = video.isShort ? `/shorts/${video.id}` : `/watch/${video.id}?autoplay=1`;
              navigate(path);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              markAutoplayIntent();
              rememberWatchedVideo(video);
              if (onVideoClick) {
                onVideoClick(video);
              } else {
                const path = video.isShort ? `/shorts/${video.id}` : `/watch/${video.id}?autoplay=1`;
                navigate(path);
              }
            }
          }}
          className="group flex cursor-pointer flex-col gap-3"
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-200 dark:bg-[#272727]">
            {video.thumbnail ? (
              <img
                src={proxyImageUrl(video.thumbnail)}
                alt={video.title}
                className="h-full w-full object-cover transition-all group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">No Thumbnail</div>
            )}
            {video.durationText ? (
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {video.durationText}
              </span>
            ) : null}
          </div>
          <div className="flex gap-3 px-0.5">
            {!hideChannel && (
              <div className="mt-1">
                {video.channelId ? (
                  <Link
                    to={`/channel/${video.channelId}`}
                    onClick={(event) => event.stopPropagation()}
                    className="block transition-transform hover:scale-105 active:scale-95"
                  >
                    <ChannelAvatar channelId={video.channelId} src={video.channelThumbnail} title={video.channelTitle} />
                  </Link>
                ) : (
                  <ChannelAvatar channelId={video.channelId} src={video.channelThumbnail} title={video.channelTitle} />
                )}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <h3 className="line-clamp-2 text-[15px] font-bold leading-tight text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-white">
                {video.title}
              </h3>
              <div className="text-[13px] text-zinc-500 dark:text-zinc-400">
                {!hideChannel && (
                  video.channelId ? (
                    <Link
                      to={`/channel/${video.channelId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="hover:text-zinc-900 hover:underline dark:hover:text-white"
                    >
                      {video.channelTitle ?? 'Unknown Channel'}
                    </Link>
                  ) : (
                    <p className="hover:text-zinc-900 dark:hover:text-white">{video.channelTitle ?? 'Unknown Channel'}</p>
                  )
                )}
                <p>
                  {[video.viewCountText, video.publishedText].filter(Boolean).join(' • ')}
                </p>
                {video.badges && video.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {video.badges.map((badge) => (
                      <Badge key={badge} variant="secondary" className="h-4 rounded-[2px] bg-zinc-200 px-1 text-[10px] font-bold text-zinc-500 hover:bg-zinc-300 dark:bg-[#272727] dark:text-zinc-400 dark:hover:bg-[#3f3f3f] dark:hover:text-white">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
