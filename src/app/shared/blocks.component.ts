import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Block, Enemy } from '../core/book/book.models';
import { ChoiceCondition } from '../core/game/choice-conditions';
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
      @if (i === firstChoice()) {
        <ng-content select="[lwBeforeChoices]" />
      }
      @switch (block.kind) {
        @case ('choice') {
          @if (interactive()) {
            @let cond = conditions()[i];
            <button
              type="button"
              class="choice"
              [class.choice--met]="cond?.status === 'met' && !cond?.negated"
              [class.choice--unmet]="cond?.status === 'unmet'"
              [disabled]="choicesDisabled() || cond?.status === 'unmet'"
              (click)="section.emit(block.target)"
            >
              <span class="choice__body">
                <span
                  class="choice__text"
                  translate="yes"
                  [attr.lang]="lang()"
                  [innerHTML]="block.html"
                ></span>
                @if (
                  cond && cond.status !== 'unknown' && !(cond.status === 'met' && cond.negated)
                ) {
                  <span class="choice__condition">
                    {{
                      cond.status === 'met'
                        ? '✓ ' + cond.disciplines.join(' · ')
                        : i18n.t(cond.negated ? 'choice.excludedBy' : 'choice.requires', {
                            disciplines: cond.disciplines.join(' / '),
                          })
                    }}
                  </span>
                }
              </span>
              <span class="choice__target">{{ block.target }}</span>
            </button>
          } @else {
            <p
              class="choice-static"
              translate="yes"
              [attr.lang]="lang()"
              [innerHTML]="block.html"
            ></p>
          }
        }
        @case ('combat') {
          <div class="combat-block">
            <p translate="yes" [attr.lang]="lang()" [innerHTML]="block.html"></p>
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
          <p class="deadend" translate="yes" [attr.lang]="lang()" [innerHTML]="block.html"></p>
        }
        @default {
          <div
            class="html-block"
            translate="yes"
            [attr.lang]="lang()"
            [innerHTML]="block.html"
          ></div>
        }
      }
    }
    @if (firstChoice() === -1) {
      <ng-content select="[lwBeforeChoices]" />
    }
  `,
})
export class BlocksComponent {
  protected readonly i18n = inject(I18nService);
  readonly bookId = input.required<string>();
  /** Langue du texte du livre : seul ce texte est traduisible par le navigateur. */
  readonly lang = input('en');
  readonly blocks = input.required<Block[]>();
  /** Choix cliquables et boutons de combat (lecture d'une section en jeu). */
  readonly interactive = input(false);
  readonly choicesDisabled = input(false);
  /** Index du bloc combat en cours : le contenu projeté (panneau de combat) s'affiche juste après. */
  readonly activeCombat = input<number | null>(null);
  /** Conditions des choix, par index de bloc (voir `evaluateChoices`). */
  readonly conditions = input<readonly (ChoiceCondition | null)[]>([]);
  /** Position du premier choix : le contenu marqué `lwBeforeChoices` s'affiche juste avant. */
  protected readonly firstChoice = computed(() =>
    this.blocks().findIndex((b) => b.kind === 'choice'),
  );

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
