import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import { GameService } from '../../core/game/game.service';
import { randomNumber } from '../../core/game/random';
import { DISCIPLINE, KAI_WEAPONSKILL_TABLE, newCharacter, rulesFor } from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { TopBarComponent } from '../../shared/top-bar.component';

@Component({
  selector: 'lw-new-game-page',
  imports: [RouterLink, TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-game.page.html',
})
export class NewGamePage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  readonly bookId = input.required<string>();

  protected readonly book = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.get(params),
  });

  protected readonly rules = computed(() => rulesFor(this.book.value()?.series ?? null));
  protected readonly csRoll = signal<number | null>(null);
  protected readonly epRoll = signal<number | null>(null);
  protected readonly selected = signal<string[]>([]);
  protected readonly weaponRoll = signal<number | null>(null);

  protected readonly isKai = computed(() => this.book.value()?.series === 'kai');
  protected readonly needsWeapon = computed(
    () =>
      this.isKai() &&
      this.selected().some((d) => d.toLowerCase() === DISCIPLINE.weaponskill.toLowerCase()),
  );
  protected readonly weapon = computed(() => {
    const roll = this.weaponRoll();
    return roll === null ? null : KAI_WEAPONSKILL_TABLE[roll];
  });
  protected readonly equipmentPage = computed(
    () => this.book.value()?.pages.find((p) => p.id === 'equipmnt') ?? null,
  );

  protected readonly canStart = computed(
    () =>
      this.csRoll() !== null &&
      this.epRoll() !== null &&
      this.selected().length === this.rules().disciplinesToChoose &&
      (!this.needsWeapon() || this.weapon() !== null),
  );

  protected rollStats(): void {
    this.csRoll.set(randomNumber());
    this.epRoll.set(randomNumber());
  }

  protected rollWeapon(): void {
    this.weaponRoll.set(randomNumber());
  }

  protected isSelected(discipline: string): boolean {
    return this.selected().includes(discipline);
  }

  protected toggle(discipline: string): void {
    this.selected.update((list) => {
      if (list.includes(discipline)) return list.filter((d) => d !== discipline);
      return list.length < this.rules().disciplinesToChoose ? [...list, discipline] : list;
    });
  }

  protected async start(): Promise<void> {
    const book = this.book.value();
    if (!book || !this.canStart()) return;
    if ((await this.game.exists(book.id)) && !confirm(this.i18n.t('newGame.overwrite'))) return;

    const character = newCharacter(book.series, this.csRoll()!, this.epRoll()!);
    character.disciplines = [...this.selected()];
    character.weaponskill = this.needsWeapon() ? this.weapon() : null;
    await this.game.newGame(book.id, character);
    await this.game.load(book.id);
    await this.router.navigate(['/book', book.id, 'play']);
  }
}
