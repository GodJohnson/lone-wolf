import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameService } from '../../core/game/game.service';
import { DISCIPLINE, hasDiscipline } from '../../core/game/rules';
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
    return !!c && hasDiscipline(c, DISCIPLINE.mindblast);
  });
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

  protected toggleMindblast(): void {
    this.game.updateCombat((c) => ({ ...c, useMindblast: !c.useMindblast }));
  }
}
