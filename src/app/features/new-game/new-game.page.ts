import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { BookRepository } from '../../core/book/book-repository';
import {
  EquipmentOption,
  Grant,
  applyGrants,
  startingEquipmentFor,
  weaponCount,
} from '../../core/game/equipment';
import { CarriedHero, alreadyOwned, carryOver } from '../../core/game/carry-over';
import { syncLoreBonus } from '../../core/game/lore-circles';
import { addToStash } from '../../core/game/stash';
import { GameService } from '../../core/game/game.service';
import { randomNumber } from '../../core/game/random';
import {
  DISCIPLINE,
  KAI_WEAPONSKILL_TABLE,
  WEAPONMASTERY_WEAPONS,
  isSkilledWeapon,
  newCharacter,
  rulesFor,
} from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/viewport.service';
import { LexiconPanelComponent } from '../reader/lexicon-panel.component';
import { TopBarComponent } from '../../shared/top-bar.component';

@Component({
  selector: 'lw-new-game-page',
  imports: [TopBarComponent, LexiconPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-game.page.html',
})
export class NewGamePage {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);

  protected readonly viewport = inject(ViewportService);
  /** Lexique consulté sans quitter le formulaire : colonne latérale (bureau) ou feuille (mobile). */
  protected readonly lexiconPage = signal<string | null>('discplnz');
  protected readonly lexiconOpen = signal(false);

  protected openLexicon(page: string): void {
    this.lexiconPage.set(page);
    this.lexiconOpen.set(true);
  }

  readonly bookId = input.required<string>();
  /** Livre précédent dont on reprend le héros (`?from=01fftd`). */
  readonly from = input<string>();

  protected readonly book = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.get(params),
  });

  protected readonly rules = computed(() => rulesFor(this.book.value()?.series ?? null));

  // ---- Reprise du héros du livre précédent ----
  private readonly previous = resource({
    params: () => this.from(),
    loader: ({ params }) => this.game.peek(params),
  });
  private readonly previousBook = resource({
    params: () => this.from(),
    loader: ({ params }) => this.books.get(params),
  });
  protected readonly carried = computed<CarriedHero | null>(() => {
    const previous = this.previous.value();
    const book = this.book.value();
    return previous && book
      ? carryOver(previous.character, book.disciplines, this.newSeries())
      : null;
  });
  /** Le héros vient d'une autre série (Kaï → Magnakai) : on rechoisit ses Disciplines. */
  protected readonly newSeries = computed(() => {
    const from = this.previousBook.value();
    const book = this.book.value();
    return !!from && !!book && from.series !== book.series;
  });
  protected readonly previousTitle = computed(() => this.previousBook.value()?.title ?? '');
  protected readonly lockedDisciplines = computed(() => this.carried()?.disciplines ?? []);
  /** Armes reportées que le joueur garde (il peut en laisser pour faire de la place). */
  protected readonly keptWeapons = signal<string[]>([]);
  private readonly carriedWeaponskill = computed(
    () => this.carried()?.character.weaponskill ?? null,
  );
  protected readonly disciplinesToChoose = computed(() =>
    this.carried() && !this.newSeries()
      ? this.lockedDisciplines().length + 1
      : this.rules().disciplinesToChoose,
  );
  protected readonly csRoll = signal<number | null>(null);
  protected readonly epRoll = signal<number | null>(null);
  protected readonly selected = signal<string[]>([]);
  protected readonly weaponRoll = signal<number | null>(null);

  protected readonly isKai = computed(() => this.book.value()?.series === 'kai');
  protected readonly needsWeapon = computed(
    () =>
      this.isKai() &&
      !this.carriedWeaponskill() &&
      this.selected().some((d) => d.toLowerCase() === DISCIPLINE.weaponskill.toLowerCase()),
  );
  protected readonly isMagnakai = computed(() => !!this.rules().loreCircles);
  /** Weaponmastery choisie : cocher des armes sur la liste (3 au départ de la série). */
  protected readonly masteryWeapons = WEAPONMASTERY_WEAPONS;
  protected readonly masteryChoice = signal<string[]>([]);
  /** 3 armes au départ de la série ; un héros reporté en garde la liste et en coche une de plus par livre. */
  protected readonly masteryCount = computed(() => {
    const existing = this.carried()?.character.weaponmastery?.length ?? 0;
    return !this.newSeries() && existing ? existing + 1 : 3;
  });
  protected readonly needsMastery = computed(
    () =>
      this.isMagnakai() &&
      this.selected().some((d) => d.toLowerCase() === DISCIPLINE.weaponmastery.toLowerCase()),
  );
  protected toggleMastery(weapon: string): void {
    this.masteryChoice.update((list) =>
      list.includes(weapon)
        ? list.filter((w) => w !== weapon)
        : list.length < this.masteryCount()
          ? [...list, weapon]
          : list,
    );
  }
  protected readonly weapon = computed(() => {
    const roll = this.weaponRoll();
    return roll === null ? null : KAI_WEAPONSKILL_TABLE[roll];
  });
  protected readonly equipmentPage = computed(
    () => this.book.value()?.pages.find((p) => p.id === 'equipmnt') ?? null,
  );

  /** Équipement de départ structuré (livres 1 à 5) ; sinon saisie manuelle sur la Feuille. */
  protected readonly equipment = computed(() => {
    const eq = startingEquipmentFor(this.bookId());
    // Livre 11 : un héros reporté a déjà son équipement, la section est sautée.
    return eq?.skipWhenCarried && this.carried() ? null : eq;
  });
  /** Le livre a un équipement de départ connu (même sauté pour un héros reporté). */
  protected readonly bookHasEquipment = computed(() => !!startingEquipmentFor(this.bookId()));
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
      (!!this.carried() || (this.csRoll() !== null && this.epRoll() !== null)) &&
      (!this.from() || !!this.carried()) &&
      this.selected().length === this.disciplinesToChoose() &&
      (!this.needsWeapon() || this.weapon() !== null) &&
      (!this.needsMastery() || this.masteryChoice().length === this.masteryCount()) &&
      this.equipmentReady(),
  );

  /**
   * Ce qu'il reste à faire pour pouvoir commencer (un bouton grisé sans explication bloque le joueur).
   * Choisir des objets d'équipement n'est jamais obligatoire : seuls le tirage d'or, les Disciplines et les
   * armes de maîtrise le sont.
   */
  protected readonly missing = computed<string[]>(() => {
    const out: string[] = [];
    if (!this.carried() && (this.csRoll() === null || this.epRoll() === null)) {
      out.push(this.i18n.t('newGame.missing.stats'));
    }
    const left = this.disciplinesToChoose() - this.selected().length;
    if (left > 0) out.push(this.i18n.t('newGame.missing.disciplines', { n: left }));
    if (left < 0) out.push(this.i18n.t('newGame.missing.tooMany', { n: -left }));
    if (this.needsWeapon() && this.weapon() === null) {
      out.push(this.i18n.t('newGame.missing.weapon'));
    }
    if (this.needsMastery() && this.masteryChoice().length !== this.masteryCount()) {
      out.push(
        this.i18n.t('newGame.missing.mastery', {
          n: this.masteryCount() - this.masteryChoice().length,
        }),
      );
    }
    const eq = this.equipment();
    if (eq && this.goldRoll() === null) out.push(this.i18n.t('newGame.missing.gold'));
    if (eq?.pick.mode === 'random' && this.itemRoll() === null) {
      out.push(this.i18n.t('newGame.missing.item'));
    }
    return out;
  });
  protected readonly startError = signal<string | null>(null);

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
    return (
      this.keptWeapons().length + weaponCount([...this.chosenOptions(), pick.options[index]]) <=
      this.rules().maxWeapons
    );
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

  protected isLocked(discipline: string): boolean {
    return this.lockedDisciplines().includes(discipline);
  }

  protected toggle(discipline: string): void {
    if (this.isLocked(discipline)) return;
    this.selected.update((list) => {
      if (list.includes(discipline)) return list.filter((d) => d !== discipline);
      return list.length < this.disciplinesToChoose() ? [...list, discipline] : list;
    });
  }

  /** L'arme reportée est l'arme maîtrisée (+2 HAB) : mise en évidence dans la liste. */
  protected isSkilled(weapon: string): boolean {
    const carried = this.carried();
    return !!carried && isSkilledWeapon(carried.character, weapon);
  }

  protected isKept(weapon: string): boolean {
    return this.keptWeapons().includes(weapon);
  }

  /** Laisser une arme libère une place ; en reprendre n'est possible que s'il en reste. */
  protected toggleKept(weapon: string): void {
    this.keptWeapons.update((list) => {
      if (list.includes(weapon)) return list.filter((w) => w !== weapon);
      const room = this.rules().maxWeapons - weaponCount(this.chosenOptions());
      return list.length < room ? [...list, weapon] : list;
    });
    // Un choix d'équipement devenu impossible (trop d'armes) est retiré.
    this.chosen.update((list) => {
      const pick = this.equipment()?.pick;
      if (pick?.mode !== 'choose') return list;
      const out: number[] = [];
      for (const i of list) {
        const options = [...out, i].map((n) => pick.options[n]);
        if (this.keptWeapons().length + weaponCount(options) <= this.rules().maxWeapons)
          out.push(i);
      }
      return out;
    });
  }

  constructor() {
    // Dès que le héros précédent est lu : disciplines reportées cochées, armes reportées gardées.
    effect(() => {
      const carried = this.carried();
      if (!carried) return;
      this.selected.set([...carried.disciplines]);
      // Héros de la même série : la liste d'armes maîtrisées est reprise, il n'en reste qu'une à ajouter.
      if (!this.newSeries()) this.masteryChoice.set([...(carried.character.weaponmastery ?? [])]);
      this.keptWeapons.set([...carried.character.weapons]);
    });
  }

  /** Armes reportées que le joueur laisse (au-delà de deux) : elles vont dans le coffre du monastère. */
  private droppedWeapons(): string[] {
    const kept = [...this.keptWeapons()];
    return (this.carried()?.character.weapons ?? []).filter((w) => {
      const i = kept.indexOf(w);
      if (i < 0) return true;
      kept.splice(i, 1);
      return false;
    });
  }

  /** Surplus d'or (au-delà de 50 couronnes) : il reste en sûreté au monastère Kai. */
  private surplusGold(): number {
    const eq = this.equipment();
    const roll = this.goldRoll();
    if (!eq || roll === null) return 0;
    const base = this.carried()?.character.gold ?? 0;
    return Math.max(0, base + eq.goldBase + roll - this.rules().maxGold);
  }

  /** Ce qui sera laissé au monastère, pour l'afficher avant de commencer. */
  protected readonly monasteryLeft = computed(() => ({
    gold: this.surplusGold(),
    items: this.droppedWeapons().length,
  }));

  protected async start(): Promise<void> {
    this.startError.set(null);
    try {
      await this.doStart();
    } catch (error) {
      // Jamais de bouton muet : le joueur voit qu'il y a eu un problème.
      console.error(error);
      this.startError.set(this.i18n.t('newGame.startFailed'));
    }
  }

  private async doStart(): Promise<void> {
    const book = this.book.value();
    if (!book || !this.canStart()) return;
    if ((await this.game.exists(book.id)) && !confirm(this.i18n.t('newGame.overwrite'))) return;

    const carried = this.carried();
    const character = carried
      ? { ...carried.character, weapons: [...this.keptWeapons()] }
      : newCharacter(book.series, this.csRoll()!, this.epRoll()!);
    character.disciplines = [...this.selected()];
    character.weaponskill =
      carried?.character.weaponskill ?? (this.needsWeapon() ? this.weapon() : null);
    if (this.needsMastery()) character.weaponmastery = [...this.masteryChoice()];

    const eq = this.equipment();
    let equipped = character;
    if (eq) {
      const picked = eq.pick.mode === 'random' ? [this.randomItem()!] : this.chosenOptions();
      const grants: Grant[] = [
        // Les objets fixes déjà reportés (ex. la carte) ne sont pas donnés en double.
        ...eq.fixed.filter((g) => !('name' in g) || !alreadyOwned(character, g.name)),
        { slot: 'gold', amount: eq.goldBase + this.goldRoll()! },
        ...picked.flatMap((o) => o.grants),
      ];
      equipped = applyGrants(character, grants, this.rules()).character;
    }
    // Surplus d'or et armes laissées : coffre du monastère Kai.
    equipped = addToStash(equipped, 'monastery', {
      gold: this.surplusGold(),
      weapons: this.droppedWeapons(),
    });
    // Cercles de Lore (Magnakai) : bonus HAB/END des Disciplines groupées.
    if (this.rules().loreCircles) equipped = syncLoreBonus(equipped);
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
