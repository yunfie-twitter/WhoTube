/// <reference types="vite/client" />

declare module 'shaka-player/dist/shaka-player.ui' {
  export * from 'shaka-player';
  import shaka from 'shaka-player';
  export default shaka;
}
