import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { BookRepository } from '../../core/book/book-repository';
import { buildLexicon } from '../../core/game/consumables';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Lexique des consommables : prix et effets relevés dans les livres importés (listes de prix, achats) et
 * effets connus de l'application, avec la place prise dans le sac à dos.
 */
@Component({
  selector: 'lw-consumables-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="card consumables">
      <summary>
        <strong>{{ i18n.t('consumables.title') }}</strong>
        @if (lexicon.value(); as list) {
          <span class="muted small">({{ list.length }})</span>
        }
      </summary>
      <p class="small muted">{{ i18n.t('consumables.hint') }}</p>
      @if (lexicon.value(); as list) {
        <ul class="consumables__list">
          @for (c of list; track c.name) {
            <li>
              <strong>{{ c.name }}</strong>
              @if (c.size > 1) {
                <span class="item-effect">{{ i18n.t('chart.places', { n: c.size }) }}</span>
              }
              @if (c.heal) {
                <div class="small">{{ i18n.t('consumables.heal', { n: c.heal }) }}</div>
              }
              @if (c.combatSkill) {
                <div class="small">{{ i18n.t('consumables.buff', { n: c.combatSkill }) }}</div>
              }
              @for (note of c.notes; track note) {
                <div class="small muted" translate="no">{{ note }}</div>
              }
              @if (c.prices.length) {
                <div class="small">
                  @for (p of c.prices; track $index) {
                    <span class="consumables__price">
                      {{ p.price }} 🪙
                      <span class="muted">
                        {{
                          i18n.t('consumables.where', {
                            book: p.book,
                            sections: p.sections.join(', §'),
                          })
                        }}
                      </span>
                    </span>
                  }
                </div>
              } @else {
                <div class="small muted">{{ i18n.t('consumables.noPrice') }}</div>
              }
            </li>
          }
        </ul>
      } @else if (lexicon.isLoading()) {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </details>
  `,
})
export class ConsumablesPanelComponent {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);

  protected readonly lexicon = resource({
    loader: async () => {
      const books = await this.books.list();
      return buildLexicon(
        await Promise.all(
          books.map(async (b) => ({
            number: b.number,
            records: await this.books.priceRecords(b.id),
          })),
        ),
      );
    },
  });
}
