import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Block, Enemy, FootnoteRecord } from '../core/book/book.models';
import { ChoiceCondition } from '../core/game/choice-conditions';
import { ITEM_LINK_PREFIX } from '../core/game/item-detection';
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
  host: {
    class: 'blocks',
    '(click)': 'onClick($event)',
    '(document:click)': 'closeFootnote($event)',
    '(document:keydown.escape)': 'footnote.set(null)',
    '(window:scroll)': 'onScroll()',
  },
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
              (click)="choose(block.target, i)"
            >
              <span class="choice__body">
                <span
                  class="choice__text"
                  translate="yes"
                  [attr.lang]="lang()"
                  [innerHTML]="block.html"
                ></span>
                @if (payments()[i]; as price) {
                  <span class="choice__condition">{{
                    i18n.t('buy.choiceHint', { price: price })
                  }}</span>
                }
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
    @if (footnote(); as note) {
      <div
        class="footnote-tip"
        role="tooltip"
        translate="yes"
        [attr.lang]="lang()"
        [style.top.px]="note.top"
        [style.bottom.px]="note.bottom"
        [style.left.px]="note.left"
        [style.width.px]="note.width"
        [innerHTML]="note.html"
      ></div>
    }
  `,
})
export class BlocksComponent {
  protected readonly i18n = inject(I18nService);
  readonly bookId = input.required<string>();
  /** Langue du texte du livre : seul ce texte est traduisible par le navigateur. */
  readonly lang = input('en');
  readonly blocks = input.required<Block[]>();
  /** Notes de bas de page de la section : un appel de note (`<sup>3</sup>`) les affiche en info-bulle. */
  readonly notes = input<readonly FootnoteRecord[]>([]);
  /** Choix cliquables et boutons de combat (lecture d'une section en jeu). */
  readonly interactive = input(false);
  readonly choicesDisabled = input(false);
  /** Index du bloc combat en cours : le contenu projeté (panneau de combat) s'affiche juste après. */
  readonly activeCombat = input<number | null>(null);
  /** Conditions des choix, par index de bloc (voir `evaluateChoices`). */
  readonly conditions = input<readonly (ChoiceCondition | null)[]>([]);
  /** Prix des choix payants par index de bloc (voir `paymentsOf`) : le choix demande confirmation. */
  readonly payments = input<readonly (number | null)[]>([]);
  /** Position du premier choix : le contenu marqué `lwBeforeChoices` s'affiche juste avant. */
  protected readonly firstChoice = computed(() =>
    this.blocks().findIndex((b) => b.kind === 'choice'),
  );

  readonly section = output<number>();
  readonly page = output<string>();
  /** Choix payant touché : la confirmation et le débit sont gérés par le lecteur. */
  readonly pay = output<{ target: number; price: number }>();
  readonly fight = output<{ index: number; enemy: Enemy }>();
  /** Lien d'objet ramassable (`#item-N`) touché : N = index dans la liste des objets détectés. */
  readonly item = output<number>();

  protected choose(target: number, index: number): void {
    const price = this.payments()[index];
    if (price) this.pay.emit({ target, price });
    else this.section.emit(target);
  }

  /** Note de bas de page affichée en info-bulle près de son appel de note. */
  protected readonly footnote = signal<{
    html: string;
    top: number | null;
    bottom: number | null;
    left: number;
    width: number;
  } | null>(null);

  private footnoteScrollY = 0;

  /** L'info-bulle est fixe à l'écran : on la ferme dès que la page a vraiment défilé. */
  protected onScroll(): void {
    if (this.footnote() && Math.abs(window.scrollY - this.footnoteScrollY) > 60) {
      this.footnote.set(null);
    }
  }

  protected closeFootnote(event: Event): void {
    if (this.footnote() && !(event.target as HTMLElement | null)?.closest('sup, .footnote-tip')) {
      this.footnote.set(null);
    }
  }

  /** Appel de note (`<sup>3</sup>`) touché : retrouve le bloc « [3] … » de la section et l'affiche. */
  private showFootnote(sup: HTMLElement): boolean {
    const number = sup.textContent?.trim() ?? '';
    if (!/^\d{1,2}$/.test(number)) return false;
    const note = this.notes().find((n) => n.number === number);
    if (!note) return false;
    const html = `<p>${note.html}</p>`;
    const rect = sup.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 12,
    );
    // Sous l'appel de note, sauf si la place manque : au-dessus alors.
    const above = rect.bottom + 8 + 170 > window.innerHeight;
    this.footnoteScrollY = window.scrollY;
    this.footnote.set({
      html,
      left,
      width,
      top: above ? null : rect.bottom + 8,
      bottom: above ? window.innerHeight - rect.top + 8 : null,
    });
    return true;
  }

  protected onClick(event: MouseEvent): void {
    const sup = (event.target as HTMLElement | null)?.closest('sup') as HTMLElement | null;
    if (sup && this.showFootnote(sup)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith(ITEM_LINK_PREFIX)) {
      event.preventDefault();
      this.item.emit(Number(href.slice(ITEM_LINK_PREFIX.length)));
      return;
    }
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
