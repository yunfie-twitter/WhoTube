export function proxyImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/image.webp')) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return url;
  return `/image.webp?url=${encodeURIComponent(url)}`;
}
