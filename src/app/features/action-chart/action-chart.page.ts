import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import { Character } from '../../core/game/game.models';
import { GameService } from '../../core/game/game.service';
import { isSkilledWeapon, rulesFor } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { CounterComponent } from '../../shared/counter.component';
import { TopBarComponent } from '../../shared/top-bar.component';
import { ItemListComponent } from './item-list.component';
import { ItemSlot, backpackLoad } from '../../core/game/equipment';

type NumericField = 'combatSkill' | 'endurance' | 'enduranceMax' | 'gold' | 'meals';

@Component({
  selector: 'lw-action-chart-page',
  imports: [TopBarComponent, ItemListComponent, CounterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-chart.page.html',
})
export class ActionChartPage {
  protected readonly i18n = inject(I18nService);
  protected readonly game = inject(GameService);
  private readonly books = inject(BookRepository);
  private readonly router = inject(Router);

  readonly bookId = input.required<string>();

  protected readonly book = resource({
    params: () => this.bookId(),
    loader: async ({ params }) => {
      const [book, state] = await Promise.all([this.books.get(params), this.game.load(params)]);
      if (!state) await this.router.navigate(['/book', params, 'new'], { replaceUrl: true });
      return book;
    },
  });
  protected readonly rules = computed(() => rulesFor(this.book.value()?.series ?? null));

  /** Bonus affiché à côté d'une arme : seule l'arme maîtrisée en donne un. */
  protected readonly weaponHint = (name: string): string => {
    const c = this.character();
    return c && isSkilledWeapon(c, name) ? `+2 ${this.i18n.t('combat.cs')} ✓` : '';
  };

  /** Liens d'objets retirés par le joueur, pour pouvoir les rétablir. */
  protected readonly userNonItems = signal(this.books.userNonItems());
  private readonly dismissedItems = linkedSignal(() => this.book.value()?.dismissedItems ?? []);
  protected readonly dismissedHere = computed(() =>
    this.dismissedItems()
      .map((key) => {
        const [section, ...rest] = key.split('|');
        return { key, section: Number(section), name: rest.join('|') };
      })
      .sort((a, b) => a.section - b.section || a.name.localeCompare(b.name)),
  );

  /** Objets déclarés à la main dans le texte, pour pouvoir retirer leur lien. */
  private readonly declaredItems = linkedSignal(() => this.book.value()?.declaredItems ?? []);
  protected readonly declaredHere = computed(() =>
    this.declaredItems()
      .map((key) => {
        const [section, ...rest] = key.split('|');
        return { key, section: Number(section), name: rest.join('|') };
      })
      .sort((a, b) => a.section - b.section || a.name.localeCompare(b.name)),
  );

  /** Achats déclarés à la main (`<section>|<prix>|<nom>`). */
  private readonly declaredPurchases = linkedSignal(
    () => this.book.value()?.declaredPurchases ?? [],
  );
  protected readonly purchasesHere = computed(() =>
    this.declaredPurchases()
      .map((key) => {
        const [section, price, ...rest] = key.split('|');
        return { key, section: Number(section), price: Number(price), name: rest.join('|') };
      })
      .sort((a, b) => a.section - b.section || a.name.localeCompare(b.name)),
  );

  /** Liens d'ENDURANCE déclarés à la main (`<section>|<montant>|<texte>`). */
  private readonly declaredEndurance = linkedSignal(
    () => this.book.value()?.declaredEndurance ?? [],
  );
  protected readonly enduranceHere = computed(() =>
    this.declaredEndurance()
      .map((key) => {
        const [section, amount, ...rest] = key.split('|');
        return { key, section: Number(section), amount: Number(amount), text: rest.join('|') };
      })
      .sort((a, b) => a.section - b.section || a.text.localeCompare(b.text)),
  );

  protected async undeclareEndurance(key: string): Promise<void> {
    this.declaredEndurance.set(await this.books.undeclareEndurance(this.bookId(), key));
  }

  protected async undeclarePurchase(key: string): Promise<void> {
    this.declaredPurchases.set(await this.books.undeclarePurchase(this.bookId(), key));
  }

  protected async undeclare(key: string): Promise<void> {
    this.declaredItems.set(await this.books.undeclareItem(this.bookId(), key));
  }

  protected restoreNonItem(term: string): void {
    this.userNonItems.set(this.books.removeUserNonItem(term));
  }

  protected async restoreDismissed(key: string): Promise<void> {
    this.dismissedItems.set(await this.books.restoreItem(this.bookId(), key));
  }
  protected readonly character = this.game.character;
  protected readonly editingDisciplines = signal(false);

  protected readonly backpackLoad = computed(() => {
    const c = this.character();
    return c ? backpackLoad(c) : 0;
  });
  protected readonly inCombat = computed(() => this.game.combat()?.outcome === 'ongoing');
  protected readonly error = signal<string | null>(null);

  protected adjust(field: NumericField, delta: number): void {
    const maxGold = this.rules().maxGold;
    this.error.set(null);
    if (field === 'meals' && delta > 0) {
      // +10 Repas dans un sac presque plein : on remplit jusqu'à la capacité.
      const room = this.rules().maxBackpackItems - this.backpackLoad();
      if (room <= 0) {
        this.error.set(this.i18n.t('chart.error.backpackFull'));
        return;
      }
      delta = Math.min(delta, room);
    }
    this.game.updateCharacter((c) => {
      const next = { ...c, [field]: Math.max(0, c[field] + delta) };
      if (field === 'gold') next.gold = Math.min(next.gold, maxGold);
      if (field === 'endurance') next.endurance = Math.min(next.endurance, next.enduranceMax);
      if (field === 'enduranceMax') next.endurance = Math.min(next.endurance, next.enduranceMax);
      return next;
    }, field);
  }

  protected eatMeal(): void {
    this.game.updateCharacter((c) => ({ ...c, meals: Math.max(0, c.meals - 1) }));
  }

  protected async addItem(slot: ItemSlot, name: string): Promise<void> {
    const error = await this.game.addItem(slot, name, this.rules());
    this.error.set(error ? this.i18n.t(`chart.error.${error}`) : null);
  }

  protected removeItem(slot: ItemSlot, index: number): void {
    this.error.set(null);
    this.game.removeItem(slot, index);
  }

  protected useItem(index: number): void {
    this.game.useItem(index);
  }

  protected toggleDiscipline(name: string): void {
    this.game.updateCharacter((c) => ({
      ...c,
      disciplines: c.disciplines.includes(name)
        ? c.disciplines.filter((d) => d !== name)
        : [...c.disciplines, name],
    }));
  }

  protected saveNotes(notes: string): void {
    if (notes !== this.character()?.notes)
      this.game.updateCharacter((c: Character) => ({ ...c, notes }));
  }

  protected async abandon(): Promise<void> {
    if (!confirm(this.i18n.t('chart.deleteConfirm'))) return;
    await this.game.deleteGame(this.bookId());
    await this.router.navigate(['/']);
  }
}
