// Live caption bar: shows what the speech recognizer heard (interim words
// dimmed, final words solid), plus mic-check hints when something is wrong.
// Lets a speaker confirm at a glance that speech is getting through, even
// before any slide appears.

const FADE_AFTER_MS = 6000;

export class CaptionBar {
  private readonly el: HTMLDivElement;
  private readonly finalEl: HTMLSpanElement;
  private readonly interimEl: HTMLSpanElement;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'caption';
    this.el.setAttribute('aria-live', 'polite');
    this.finalEl = document.createElement('span');
    this.interimEl = document.createElement('span');
    this.interimEl.className = 'interim';
    this.el.append(this.finalEl, this.interimEl);
    host.append(this.el);
  }

  /** Recognized speech. Final text replaces the line; interim text trails it. */
  speech(text: string, isFinal: boolean): void {
    this.el.classList.remove('hint');
    if (isFinal) {
      this.finalEl.textContent = text;
      this.interimEl.textContent = '';
    } else {
      this.interimEl.textContent = ` ${text}`;
    }
    this.show();
  }

  /** A mic-check message (stays until speech arrives or clear()). */
  hint(text: string): void {
    this.el.classList.add('hint');
    this.finalEl.textContent = text;
    this.interimEl.textContent = '';
    this.el.classList.add('visible');
    if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
  }

  clear(): void {
    this.el.classList.remove('visible', 'hint');
  }

  private show(): void {
    this.el.classList.add('visible');
    if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => this.el.classList.remove('visible'), FADE_AFTER_MS);
  }
}
