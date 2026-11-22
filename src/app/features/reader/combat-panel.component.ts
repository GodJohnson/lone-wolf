import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { itemEffect } from '../../core/game/equipment';
import { GameService } from '../../core/game/game.service';
import {
  DISCIPLINE,
  hasDiscipline,
  hasSommerswerd,
  mindforceProtected,
} from '../../core/game/rules';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'lw-combat-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combat-panel.component.html',
})
export class CombatPanelComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly game = inject(GameService);

  protected readonly combat = this.game.combat;
  protected readonly character = this.game.character;
  protected readonly cs = this.game.combatSkill;
  protected readonly ratio = computed(() => {
    const combat = this.combat();
    const cs = this.cs();
    return combat && cs ? cs.total - combat.enemy.combatSkill : 0;
  });
  protected readonly canMindblast = computed(() => {
    const c = this.character();
    return !!c && (hasDiscipline(c, DISCIPLINE.mindblast) || hasDiscipline(c, DISCIPLINE.psisurge));
  });
  /** Psi-surge (Magnakai) : possédé, mais impossible quand l'ENDURANCE est à 6 ou moins. */
  protected readonly canPsiSurge = computed(() => {
    const c = this.character();
    return !!c && hasDiscipline(c, DISCIPLINE.psisurge);
  });
  protected readonly mindProtected = computed(() => {
    const c = this.character();
    return !!c && mindforceProtected(c);
  });

  protected toggleMindforce(): void {
    this.game.updateCombat((c) => ({ ...c, mindforce: c.mindforce ? 0 : 2 }));
  }

  /** Objets à effet temporaire du sac à dos, avalables avant le premier assaut. */
  protected readonly swallowable = computed(() => {
    const c = this.character();
    const combat = this.combat();
    if (!c || !combat || combat.outcome !== 'ongoing' || combat.rounds.length) return [];
    return c.backpack
      .map((name, index) => ({ name, index, buff: itemEffect(name)?.buff }))
      .filter((o): o is { name: string; index: number; buff: { combatSkill: number } } => !!o.buff);
  });
  protected readonly buffError = signal<string | null>(null);

  protected async swallow(index: number): Promise<void> {
    this.buffError.set(null);
    const error = await this.game.swallowInCombat(index);
    if (error === 'buffActive') this.buffError.set(this.i18n.t('chart.error.buffActive'));
  }

  protected readonly psiSurgeLow = computed(() => (this.character()?.endurance ?? 0) <= 6);
  protected readonly rounds = computed(() => [...(this.combat()?.rounds ?? [])].reverse());

  protected signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  protected loss(value: number | 'K'): string {
    return value === 'K' ? this.i18n.t('combat.killed') : String(value);
  }

  protected adjustModifier(delta: number): void {
    this.game.updateCombat((c) => ({ ...c, modifier: c.modifier + delta }));
  }

  protected readonly hasSommerswerd = computed(() => {
    const c = this.game.character();
    return !!c && hasSommerswerd(c);
  });

  protected toggleUndead(): void {
    this.game.updateCombat((c) => ({ ...c, undead: !c.undead }));
  }

  /** Psi-surge et Mindblast ne se cumulent pas : activer l'un coupe l'autre. */
  protected toggleMindblast(): void {
    this.game.updateCombat((c) => ({
      ...c,
      useMindblast: !c.useMindblast,
      usePsiSurge: !c.useMindblast ? false : c.usePsiSurge,
    }));
  }

  protected togglePsiSurge(): void {
    this.game.updateCombat((c) => ({
      ...c,
      usePsiSurge: !c.usePsiSurge,
      useMindblast: !c.usePsiSurge ? false : c.useMindblast,
    }));
  }
}
