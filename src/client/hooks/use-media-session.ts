import { useEffect } from 'react';
import { proxyImageUrl } from '../lib/images';

interface MediaSessionProps {
  videoId?: string;
  title?: string;
  author?: string;
  poster?: string;
  playerState: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerReady: boolean;
}

export function useMediaSession({
  videoId,
  title,
  author,
  poster,
  playerState,
  videoRef,
  playerReady
}: MediaSessionProps) {
  useEffect(() => {
    if (!('mediaSession' in navigator) || !videoId || !title) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: author,
      album: 'WhoTube',
      artwork: [
        { src: proxyImageUrl(poster) || '', sizes: '512x512', type: 'image/png' },
        { src: proxyImageUrl(poster) || '', sizes: '192x192', type: 'image/png' },
        { src: proxyImageUrl(poster) || '', sizes: '144x144', type: 'image/png' },
        { src: proxyImageUrl(poster) || '', sizes: '96x96', type: 'image/png' }
      ]
    });

    const getPlaybackVideo = () => videoRef.current;

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => {
        const video = getPlaybackVideo();
        if (video) video.play().catch(() => {});
      }],
      ['pause', () => {
        const video = getPlaybackVideo();
        if (video) video.pause();
      }],
      ['seekbackward', (details) => {
        const video = getPlaybackVideo();
        if (video) video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || 10));
      }],
      ['seekforward', (details) => {
        const video = getPlaybackVideo();
        if (video) video.currentTime = Math.min(video.duration, video.currentTime + (details.seekOffset || 10));
      }],
      ['seekto', (details) => {
        const video = getPlaybackVideo();
        if (video && details.seekTime !== undefined) video.currentTime = details.seekTime;
      }],
      ['previoustrack', null],
      ['nexttrack', null]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Some actions might not be supported in all browsers
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch (e) {}
      }
      navigator.mediaSession.metadata = null;
    };
  }, [title, author, poster, videoId, videoRef]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playerState === 1 ? 'playing' : (playerState === 2 ? 'paused' : 'none');
  }, [playerState]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !('mediaSession' in navigator)) return;

    const updatePosition = () => {
      try {
        if (Number.isFinite(video.duration) && Number.isFinite(video.currentTime)) {
          navigator.mediaSession.setPositionState({
            duration: video.duration,
            playbackRate: video.playbackRate,
            position: video.currentTime
          });
        }
      } catch (e) {
        // Handle potential errors
      }
    };

    video.addEventListener('timeupdate', updatePosition);
    video.addEventListener('ratechange', updatePosition);
    return () => {
      video.removeEventListener('timeupdate', updatePosition);
      video.removeEventListener('ratechange', updatePosition);
    };
  }, [playerReady, videoRef]);
}
