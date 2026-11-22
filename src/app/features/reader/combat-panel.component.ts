import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
