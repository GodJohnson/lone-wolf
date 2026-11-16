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
import {
  EquipmentOption,
  Grant,
  applyGrants,
  startingEquipmentFor,
  weaponCount,
} from '../../core/game/equipment';
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

  /** Équipement de départ structuré (livres 1 à 5) ; sinon saisie manuelle sur la Feuille. */
  protected readonly equipment = computed(() => startingEquipmentFor(this.bookId()));
  protected readonly goldRoll = signal<number | null>(null);
  protected readonly itemRoll = signal<number | null>(null);
  protected readonly chosen = signal<number[]>([]);

  protected readonly randomItem = computed(() => {
    const pick = this.equipment()?.pick;
    const roll = this.itemRoll();
    return pick?.mode === 'random' && roll !== null ? pick.table[roll] : null;
  });
  protected readonly chosenOptions = computed<EquipmentOption[]>(() => {
    const pick = this.equipment()?.pick;
    return pick?.mode === 'choose' ? this.chosen().map((i) => pick.options[i]) : [];
  });
  protected readonly fixedLabels = computed(() =>
    (this.equipment()?.fixed ?? []).map((g) => grantLabel(g)),
  );
  protected readonly equipmentReady = computed(() => {
    const eq = this.equipment();
    if (!eq) return true;
    if (this.goldRoll() === null) return false;
    return eq.pick.mode === 'random' ? this.itemRoll() !== null : true;
  });

  protected readonly canStart = computed(
    () =>
      this.csRoll() !== null &&
      this.epRoll() !== null &&
      this.selected().length === this.rules().disciplinesToChoose &&
      (!this.needsWeapon() || this.weapon() !== null) &&
      this.equipmentReady(),
  );

  protected rollStats(): void {
    this.csRoll.set(randomNumber());
    this.epRoll.set(randomNumber());
  }

  protected rollWeapon(): void {
    this.weaponRoll.set(randomNumber());
  }

  protected rollGold(): void {
    this.goldRoll.set(randomNumber());
  }

  protected rollItem(): void {
    this.itemRoll.set(randomNumber());
  }

  protected isChosen(index: number): boolean {
    return this.chosen().includes(index);
  }

  /** Une option est indisponible si le quota est atteint ou si elle dépasserait le nombre d'armes. */
  protected canChoose(index: number): boolean {
    const pick = this.equipment()?.pick;
    if (pick?.mode !== 'choose' || this.isChosen(index)) return true;
    if (this.chosen().length >= pick.count) return false;
    return weaponCount([...this.chosenOptions(), pick.options[index]]) <= this.rules().maxWeapons;
  }

  protected toggleOption(index: number): void {
    if (!this.canChoose(index)) return;
    this.chosen.update((list) =>
      list.includes(index) ? list.filter((i) => i !== index) : [...list, index],
    );
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

    const eq = this.equipment();
    let equipped = character;
    if (eq) {
      const picked = eq.pick.mode === 'random' ? [this.randomItem()!] : this.chosenOptions();
      const grants: Grant[] = [
        ...eq.fixed,
        { slot: 'gold', amount: eq.goldBase + this.goldRoll()! },
        ...picked.flatMap((o) => o.grants),
      ];
      equipped = applyGrants(character, grants, this.rules()).character;
    }
    await this.game.newGame(book.id, equipped);
    await this.game.load(book.id);
    await this.router.navigate(['/book', book.id, 'play']);
  }
}

function grantLabel(grant: Grant): string {
  switch (grant.slot) {
    case 'meals':
      return grant.count > 1 ? `${grant.count} × Meal` : 'Meal';
    case 'gold':
      return `${grant.amount} Gold Crowns`;
    default:
      return grant.name;
  }
}
