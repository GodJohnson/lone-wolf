import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Zones où une sélection de texte ne peut pas être un objet à ramasser. */
const EXCLUDED =
  'button, a, .choice, .combat-block, .lexicon, lw-combat-panel, lw-item-sheet, input, textarea';

/**
 * Déclarer un objet que la détection n'a pas repéré : le joueur sélectionne les mots dans le texte
 * (appui long sur mobile, glisser à la souris) et une barre propose de l'ajouter à l'inventaire.
 */
@Component({
  selector: 'lw-selection-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text(); as selected) {
      <div class="selection-bar">
        <button
          type="button"
          class="button button--primary"
          (pointerdown)="$event.preventDefault()"
          (mousedown)="$event.preventDefault()"
          (click)="declare.emit(selected)"
        >
          ＋ {{ i18n.t('declare.add', { text: shorten(selected) }) }}
        </button>
        <button
          type="button"
          class="button"
          (pointerdown)="$event.preventDefault()"
          (mousedown)="$event.preventDefault()"
          (click)="declarePurchase.emit(selected)"
        >
          🪙 {{ i18n.t('buy.declareAction', { text: shorten(selected) }) }}
        </button>
        <button
          type="button"
          class="button"
          (pointerdown)="$event.preventDefault()"
          (mousedown)="$event.preventDefault()"
          (click)="declareEndurance.emit(selected)"
        >
          ❤ {{ i18n.t('endurance.declareAction') }}
        </button>
      </div>
    }
  `,
})
export class SelectionBarComponent {
  protected readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  /** Mots sélectionnés, à ajouter comme objet. */
  readonly declare = output<string>();
  /** Mots sélectionnés, à acheter (ligne de prix non détectée). */
  readonly declarePurchase = output<string>();
  /** Mots sélectionnés, à lier comme perte ou gain d'ENDURANCE. */
  readonly declareEndurance = output<string>();
  protected readonly text = signal<string | null>(null);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => this.text.set(this.currentSelection()), 150);
    };
    this.document.addEventListener('selectionchange', onChange);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('selectionchange', onChange);
      if (timer) clearTimeout(timer);
    });
  }

  protected shorten(text: string): string {
    return text.length > 28 ? text.slice(0, 27) + '…' : text;
  }

  private currentSelection(): string | null {
    const selection = this.document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const node = selection.getRangeAt(0).commonAncestorContainer;
    const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    if (!element?.closest('.section-text') || element.closest(EXCLUDED)) return null;
    const text = selection.toString().replace(/\s+/g, ' ').trim();
    return text.length >= 2 && text.length <= 60 ? text : null;
  }
}
