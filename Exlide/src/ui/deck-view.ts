// Thin wrapper around reveal.js. Takes immutable DeckState snapshots and
// patches the DOM to match: unchanged slides and bullets are left alone (no
// flicker), new or changed bullets fade in. All text goes in via textContent
// because it comes from a model and is untrusted.

import Reveal from 'reveal.js';
import 'reveal.js/reveal.css';
import 'reveal.js/theme/black.css';
import type { DeckState, Slide } from '../core/deck.ts';

type RevealApi = InstanceType<typeof Reveal>;

const ENTER_CLASS = 'enter';

export class DeckView {
  private readonly root: HTMLDivElement;
  private readonly slidesEl: HTMLDivElement;
  private readonly emptyEl: HTMLParagraphElement;
  private reveal: RevealApi | null = null;
  private rendered: DeckState | null = null;

  constructor(container: HTMLElement, emptyText: string) {
    this.root = document.createElement('div');
    this.root.className = 'reveal';
    this.slidesEl = document.createElement('div');
    this.slidesEl.className = 'slides';
    this.root.append(this.slidesEl);
    this.emptyEl = document.createElement('p');
    this.emptyEl.className = 'empty';
    this.emptyEl.textContent = emptyText;
    container.replaceChildren(this.root, this.emptyEl);
  }

  async init(): Promise<void> {
    // reveal.js needs at least one section to initialise.
    this.slidesEl.append(this.makeSection({ id: '__placeholder', title: '', bullets: [] }));
    const reveal = new Reveal(this.root, {
      embedded: true,
      hash: false,
      history: false,
      controls: false,
      progress: true,
      slideNumber: false,
      keyboard: false,
      touch: false,
      overview: false,
      help: false,
      center: true,
      transition: 'slide',
      transitionSpeed: 'default',
      backgroundTransition: 'fade',
    });
    await reveal.initialize();
    this.reveal = reveal;
    this.slidesEl.replaceChildren();
    this.updateEmptyState(0);
  }

  /** Renders a deck snapshot. Cheap no-op when the version is unchanged. */
  render(deck: DeckState): void {
    const reveal = this.reveal;
    if (!reveal) throw new Error('DeckView.render called before init()');
    if (this.rendered?.version === deck.version) return;

    const existing = new Map<string, HTMLElement>();
    for (const el of Array.from(this.slidesEl.children)) {
      if (el instanceof HTMLElement && el.dataset['id']) existing.set(el.dataset['id'], el);
    }

    // Build the target order, reusing sections where possible.
    const ordered: HTMLElement[] = deck.slides.map((slide) => {
      const section = existing.get(slide.id);
      existing.delete(slide.id);
      if (!section) return this.makeSection(slide);
      this.patchSection(section, slide);
      return section;
    });
    for (const stale of existing.values()) stale.remove();
    ordered.forEach((section, i) => {
      if (this.slidesEl.children[i] !== section) this.slidesEl.insertBefore(section, this.slidesEl.children[i] ?? null);
    });

    reveal.sync();
    const index = deck.slides.findIndex((s) => s.id === deck.currentId);
    if (index !== -1) reveal.slide(index);
    this.updateEmptyState(deck.slides.length);
    this.rendered = deck;
  }

  private updateEmptyState(slideCount: number): void {
    this.emptyEl.hidden = slideCount > 0;
    this.root.style.visibility = slideCount > 0 ? 'visible' : 'hidden';
  }

  private makeSection(slide: Slide): HTMLElement {
    const section = document.createElement('section');
    section.dataset['id'] = slide.id;
    const h2 = document.createElement('h2');
    h2.textContent = slide.title;
    const ul = document.createElement('ul');
    for (const bullet of slide.bullets) ul.append(this.makeBullet(bullet));
    section.append(h2, ul);
    return section;
  }

  private makeBullet(text: string): HTMLLIElement {
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add(ENTER_CLASS);
    li.addEventListener('animationend', () => li.classList.remove(ENTER_CLASS), { once: true });
    return li;
  }

  private patchSection(section: HTMLElement, slide: Slide): void {
    const h2 = section.querySelector('h2');
    if (h2 && h2.textContent !== slide.title) {
      h2.textContent = slide.title;
      h2.classList.remove(ENTER_CLASS);
      void h2.offsetWidth; // restart the animation
      h2.classList.add(ENTER_CLASS);
    }
    const ul = section.querySelector('ul');
    if (!ul) return;
    const items = Array.from(ul.children);
    slide.bullets.forEach((text, i) => {
      const li = items[i];
      if (li?.textContent === text) return;
      const fresh = this.makeBullet(text);
      if (li) li.replaceWith(fresh);
      else ul.append(fresh);
    });
    for (const extra of items.slice(slide.bullets.length)) extra.remove();
  }
}
