import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Block, Enemy } from '../core/book/book.models';
import { I18nService } from '../core/i18n/i18n.service';
import { BookImageComponent } from './book-image.component';

export type BookLink = { kind: 'section'; number: number } | { kind: 'page'; id: string };

/**
 * Rendu des blocs d'une section ou d'une page.
 * Les liens internes du livre (`sect12.htm`, `random.htm`...) sont interceptés et convertis
 * en événements : aucune navigation vers le site Project Aon ni vers un fichier relatif.
 */
@Component({
  selector: 'lw-blocks',
  imports: [BookImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'blocks', '(click)': 'onClick($event)' },
  template: `
    @for (block of blocks(); track $index; let i = $index) {
      @switch (block.kind) {
        @case ('choice') {
          @if (interactive()) {
            <button
              type="button"
              class="choice"
              [disabled]="choicesDisabled()"
              (click)="section.emit(block.target)"
            >
              <span class="choice__text" [innerHTML]="block.html"></span>
              <span class="choice__target">{{ block.target }}</span>
            </button>
          } @else {
            <p class="choice-static" [innerHTML]="block.html"></p>
          }
        }
        @case ('combat') {
          <div class="combat-block">
            <p [innerHTML]="block.html"></p>
            @if (interactive() && block.enemy; as enemy) {
              <button
                type="button"
                class="button button--danger"
                (click)="fight.emit({ index: i, enemy })"
              >
                ⚔ {{ i18n.t('reader.fight') }}
              </button>
            }
          </div>
          @if (activeCombat() === i) {
            <ng-content />
          }
        }
        @case ('figure') {
          <figure><lw-book-image [bookId]="bookId()" [name]="block.image" /></figure>
        }
        @case ('deadend') {
          <p class="deadend" [innerHTML]="block.html"></p>
        }
        @default {
          <div class="html-block" [innerHTML]="block.html"></div>
        }
      }
    }
  `,
})
export class BlocksComponent {
  protected readonly i18n = inject(I18nService);
  readonly bookId = input.required<string>();
  readonly blocks = input.required<Block[]>();
  /** Choix cliquables et boutons de combat (lecture d'une section en jeu). */
  readonly interactive = input(false);
  readonly choicesDisabled = input(false);
  /** Index du bloc combat en cours : le contenu projeté (panneau de combat) s'affiche juste après. */
  readonly activeCombat = input<number | null>(null);

  readonly section = output<number>();
  readonly page = output<string>();
  readonly fight = output<{ index: number; enemy: Enemy }>();

  protected onClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    event.preventDefault();
    const link = parseBookLink(href);
    if (!link) return;
    // Un lien de section dans un choix est déjà géré par le bouton englobant.
    if (link.kind === 'section') {
      if (!anchor.closest('button.choice')) this.section.emit(link.number);
    } else {
      event.stopPropagation();
      this.page.emit(link.id);
    }
  }
}

export function parseBookLink(href: string): BookLink | null {
  const file = href.split('#')[0];
  const section = /^sect(\d+)\.htm$/i.exec(file);
  if (section) return { kind: 'section', number: Number(section[1]) };
  const page = /^([a-z0-9_-]+)\.htm$/i.exec(file);
  return page ? { kind: 'page', id: page[1] } : null;
}
