import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { VideoService } from './video.service.js';

export class MetaService {
  private static indexHtml: string | null = null;

  private static async getIndexHtml(): Promise<string> {
    if (this.indexHtml) return this.indexHtml;
    const filePath = path.resolve(process.cwd(), 'dist', 'index.html');
    try {
      this.indexHtml = await readFile(filePath, 'utf-8');
      return this.indexHtml!;
    } catch {
      // Fallback to source index.html if dist doesn't exist
      const sourcePath = path.resolve(process.cwd(), 'index.html');
      this.indexHtml = await readFile(sourcePath, 'utf-8');
      return this.indexHtml!;
    }
  }

  static async getWatchHtml(videoId: string, baseUrl: string): Promise<string> {
    const html = await this.getIndexHtml();
    
    try {
      const details = await VideoService.getVideoDetails(videoId);
      const title = `${details.title} - WhoTube`;
      const description = details.description.substring(0, 200);
      const thumbnail = details.thumbnail;
      const watchUrl = `${baseUrl}/watch?v=${videoId}`;
      const oembedUrl = `${baseUrl}/api/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

      const metaTags = `
    <title>${title}</title>
    <meta name="title" content="${details.title}">
    <meta name="description" content="${description}">
    <link rel="image_src" href="${thumbnail}">
    <link rel="alternate" type="application/json+oembed" href="${oembedUrl}" title="${details.title}">
    
    <!-- OGP -->
    <meta property="og:site_name" content="WhoTube">
    <meta property="og:type" content="video.other">
    <meta property="og:title" content="${details.title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${watchUrl}">
    <meta property="og:image" content="${thumbnail}">
    <meta property="og:video" content="${baseUrl}/embed/${videoId}">
    <meta property="og:video:secure_url" content="${baseUrl}/embed/${videoId}">
    <meta property="og:video:type" content="text/html">
    <meta property="og:video:width" content="1280">
    <meta property="og:video:height" content="720">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@WhoTube">
    <meta name="twitter:title" content="${details.title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${thumbnail}">
    <meta name="twitter:player" content="${baseUrl}/embed/${videoId}">
    <meta name="twitter:player:width" content="1280">
    <meta name="twitter:player:height" content="720">
      `.trim();

      // Replace existing title if any, or insert into head
      let modifiedHtml = html.replace(/<title>.*?<\/title>/, '');
      modifiedHtml = modifiedHtml.replace('</head>', `${metaTags}\n  </head>`);
      
      return modifiedHtml;
    } catch (e) {
      console.error('[MetaService] Failed to generate meta tags:', e);
      return html;
    }
  }

  static async getOEmbed(videoUrl: string, baseUrl: string) {
    const url = new URL(videoUrl);
    let videoId = url.searchParams.get('v');
    
    if (!videoId) {
      const paths = url.pathname.split('/');
      if (paths[1] === 'watch' || paths[1] === 'shorts' || paths[1] === 'embed') {
        videoId = paths[2];
      }
    }

    if (!videoId) throw new Error('Invalid video URL');

    const details = await VideoService.getVideoDetails(videoId);
    
    return {
      title: details.title,
      author_name: details.author,
      author_url: details.authorUrl || `${baseUrl}/channel/${details.authorId}`,
      type: 'video',
      height: 720,
      width: 1280,
      version: '1.0',
      provider_name: 'WhoTube',
      provider_url: baseUrl,
      thumbnail_url: details.thumbnail,
      thumbnail_width: 480,
      thumbnail_height: 360,
      html: `<iframe width="1280" height="720" src="${baseUrl}/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>`
    };
  }
}
