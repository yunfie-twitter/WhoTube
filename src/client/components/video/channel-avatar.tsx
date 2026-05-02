import { useQuery } from '@tanstack/react-query';
import { getChannel } from '../../lib/api';
import { proxyImageUrl } from '../../lib/images';

interface Props {
  channelId?: string;
  src?: string;
  title?: string;
  sizeClassName?: string;
}

export function ChannelAvatar({ channelId, src, title, sizeClassName = 'h-9 w-9' }: Props) {
  const channelQuery = useQuery({
    queryKey: ['channel-avatar', channelId],
    queryFn: () => getChannel(channelId || ''),
    enabled: Boolean(!src && channelId && channelId !== 'N/A'),
    staleTime: 1000 * 60 * 60
  });
  const image = proxyImageUrl(src) || channelQuery.data?.channel.thumbnail;

  if (image) {
    return <img src={image} alt="" className={`${sizeClassName} aspect-square shrink-0 rounded-full bg-zinc-800 object-cover`} />;
  }

  return (
    <div className={`${sizeClassName} flex shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300`}>
      {(title || '?').slice(0, 1)}
    </div>
  );
}
