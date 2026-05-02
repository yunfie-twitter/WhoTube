import shaka from 'shaka-player/dist/shaka-player.ui';

// Shaka UI カスタム要素の登録
export class TheaterModeButton extends (shaka as any).ui.Element {
  private button_: HTMLButtonElement;

  constructor(parent: HTMLElement, controls: any) {
    super(parent, controls);

    this.button_ = document.createElement('button');
    this.button_.classList.add('shaka-theater-mode-button');
    // 直接SVGを埋め込む
    this.button_.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h10V9H7v6z"/></svg>`;
    this.button_.title = 'シアターモード';
    this.button_.style.color = 'white';
    
    (this as any).parent.appendChild(this.button_);

    (this as any).eventManager.listen(this.button_, 'click', () => {
      window.dispatchEvent(new CustomEvent('whotube:toggle-theater'));
    });
  }
}

let isRegistered = false;

export function registerShakaCustomElements() {
  if (isRegistered) return;
  
  const shakaAny = shaka as any;
  if (typeof shaka !== 'undefined' && shakaAny.ui && shakaAny.ui.Controls) {
    shakaAny.ui.Controls.registerElement('theater_mode', {
      create(parent: HTMLElement, controls: any) {
        return new TheaterModeButton(parent, controls);
      }
    });
    isRegistered = true;
  }
}
