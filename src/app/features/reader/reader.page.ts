import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import { Enemy } from '../../core/book/book.models';
import { MealChoice, requiresMeal } from '../../core/game/equipment';
import { evaluateChoices } from '../../core/game/choice-conditions';
import { FoundItem, annotateItems, itemKey } from '../../core/game/item-detection';
import { rulesFor } from '../../core/game/rules';
import { ItemSheetComponent } from './item-sheet.component';
import { CharacterPanelComponent } from './character-panel.component';
import { LexiconPanelComponent } from './lexicon-panel.component';
import { ViewportService } from '../../core/viewport.service';
import { GameService } from '../../core/game/game.service';
import { DISCIPLINE, hasDiscipline } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { BlocksComponent } from '../../shared/blocks.component';
import { RandomNumberComponent } from '../../shared/random-number.component';
import { TopBarComponent } from '../../shared/top-bar.component';
import { useBookLanguage } from '../../shared/book-language';
import { CombatPanelComponent } from './combat-panel.component';

@Component({
  selector: 'lw-reader-page',
  imports: [
    RouterLink,
    TopBarComponent,
    BlocksComponent,
    RandomNumberComponent,
    CombatPanelComponent,
    ItemSheetComponent,
    CharacterPanelComponent,
    LexiconPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reader.page.html',
})
export class ReaderPage {
  protected readonly i18n = inject(I18nService);
  protected readonly game = inject(GameService);
  private readonly books = inject(BookRepository);
  private readonly router = inject(Router);

  readonly bookId = input.required<string>();

  protected readonly viewport = inject(ViewportService);
  protected readonly showRandom = signal(false);
  protected readonly toast = signal<string | null>(null);

  protected readonly book = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.get(params),
  });

  private readonly loaded = resource({
    params: () => this.bookId(),
    loader: async ({ params }) => {
      const state = await this.game.load(params);
      if (!state) await this.router.navigate(['/book', params, 'new'], { replaceUrl: true });
      return state;
    },
  });

  protected readonly sectionNumber = computed(() =>
    this.loaded.hasValue() ? (this.game.state()?.section ?? null) : null,
  );

  protected readonly section = resource({
    params: () => {
      const n = this.sectionNumber();
      return n === null ? undefined : { bookId: this.bookId(), number: n };
    },
    loader: ({ params }) => this.books.section(params.bookId, params.number),
  });

  /** La section impose un Repas qui n'a pas encore été réglé. */
  protected readonly mealDue = computed(() => {
    const blocks = this.section.value()?.blocks ?? [];
    const text = blocks.map((b) => ('html' in b ? b.html.replace(/<[^>]+>/g, '') : '')).join(' ');
    return requiresMeal(text) && !this.game.state()?.mealResolved && !this.game.isDead();
  });
  /** Mots non-objets du livre (créatures, lieux…) pour la détection des objets ramassables. */
  private readonly nonItemWords = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.nonItemWords(params),
  });

  /** Blocs de la section avec les objets ramassables transformés en liens. */
  /** Termes marqués « Pas un objet » (tous livres). */
  private readonly userNonItems = signal(this.books.userNonItems());
  /** Liens écartés par le joueur (« Pas ramassable ici »), mis à jour sans recharger le livre. */
  private readonly dismissedItems = linkedSignal(() => this.book.value()?.dismissedItems ?? []);
  protected readonly annotated = computed(() => {
    const section = this.sectionNumber();
    const prefix = `${section}|`;
    const ignored = new Set(
      this.dismissedItems()
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length)),
    );
    return annotateItems(
      this.section.value()?.blocks ?? [],
      this.nonItemWords.value() ?? [],
      ignored,
      this.userNonItems(),
    );
  });
  protected readonly rules = computed(() => rulesFor(this.book.value()?.series ?? null));
  protected readonly selectedItem = signal<FoundItem | null>(null);

  protected openItem(index: number): void {
    const item = this.annotated().items[index];
    if (item && !this.game.isDead()) this.selectedItem.set(item);
  }

  protected foundLabel(item: FoundItem): string {
    return item.kind === 'item' ? item.name : item.label;
  }

  protected async dismissItem(): Promise<void> {
    const item = this.selectedItem();
    const section = this.sectionNumber();
    this.selectedItem.set(null);
    if (!item || section === null) return;
    this.dismissedItems.set(
      await this.books.dismissItem(this.bookId(), `${section}|${itemKey(item)}`),
    );
  }

  protected markNotAnItem(): void {
    const item = this.selectedItem();
    this.selectedItem.set(null);
    if (item?.kind === 'item') this.userNonItems.set(this.books.addUserNonItem(item.name));
  }

  protected itemAdded(label: string): void {
    this.selectedItem.set(null);
    this.flash(this.i18n.t('item.added', { item: label }));
  }

  /** Choix accessibles selon les disciplines du personnage. */
  protected readonly choiceConditions = computed(() =>
    evaluateChoices(
      this.section.value()?.blocks ?? [],
      this.game.character()?.disciplines ?? [],
      this.book.value()?.disciplines ?? [],
    ),
  );

  protected readonly canHunt = computed(() => {
    const c = this.game.character();
    return !!c && hasDiscipline(c, DISCIPLINE.hunting);
  });

  protected eat(choice: MealChoice): void {
    this.game.resolveMeal(choice);
  }

  protected readonly isDeadEnd = computed(
    () => !!this.section.value()?.blocks.some((b) => b.kind === 'deadend'),
  );

  /** Astuce « Traduire » : affichée si l'interface est en français (les livres Project Aon sont en anglais ou espagnol). */
  protected readonly showTranslateTip = signal(!readTipDismissed());
  protected readonly translateTipVisible = computed(
    () => this.showTranslateTip() && this.i18n.lang() === 'fr' && !!this.book.value(),
  );

  protected dismissTranslateTip(): void {
    this.showTranslateTip.set(false);
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      // Stockage indisponible : l'astuce réapparaîtra simplement plus tard.
    }
  }

  constructor() {
    useBookLanguage(() => this.book.value()?.lang);
    // Remonte en haut de page à chaque changement de section.
    effect(() => {
      if (this.sectionNumber() !== null) window.scrollTo({ top: 0 });
    });
  }

  protected async goTo(target: number): Promise<void> {
    const before = this.game.character()?.endurance ?? 0;
    await this.game.goTo(target);
    const after = this.game.character()?.endurance ?? 0;
    if (after > before) this.flash(this.i18n.t('reader.healing'));
  }

  protected openPage(pageId: string): void {
    if (pageId === 'random') {
      this.showRandom.set(true);
      return;
    }
    if (pageId === 'action') {
      this.router.navigate(['/book', this.bookId(), 'chart']);
      return;
    }
    this.router.navigate(['/book', this.bookId(), 'page', pageId]);
  }

  protected fight(event: { index: number; enemy: Enemy }): void {
    this.game.startCombat(event.index, event.enemy);
  }

  private flash(text: string): void {
    this.toast.set(text);
    setTimeout(() => this.toast.set(null), 2500);
  }
}

const TIP_KEY = 'lone-wolf.translateTipDismissed';

function readTipDismissed(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === '1';
  } catch {
    return false;
  }
}
