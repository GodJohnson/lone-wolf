import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Liste d'objets éditable (armes, sac à dos, objets spéciaux), avec capacité optionnelle. */
@Component({
  selector: 'lw-item-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ title() }}</h2>
    <ul class="item-list">
      @for (item of items(); track $index) {
        <li>
          <span>{{ item }}</span>
          <button
            type="button"
            class="icon-button"
            (click)="remove($index)"
            [attr.aria-label]="i18n.t('common.delete') + ' ' + item"
          >
            ✕
          </button>
        </li>
      }
    </ul>
    @if (full()) {
      <p class="small muted">{{ i18n.t('chart.full') }}</p>
    } @else {
      <form class="item-add" (submit)="add($event)">
        <input
          type="text"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          [placeholder]="i18n.t('chart.newItem')"
          maxlength="60"
          enterkeyhint="done"
        />
        <button type="submit" class="button button--small" [disabled]="!draft().trim()">
          {{ i18n.t('common.add') }}
        </button>
      </form>
    }
  `,
})
export class ItemListComponent {
  protected readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly items = input.required<string[]>();
  readonly max = input<number | null>(null);
  readonly changed = output<string[]>();

  protected readonly draft = signal('');
  protected readonly full = computed(() => {
    const max = this.max();
    return max !== null && this.items().length >= max;
  });

  protected add(event: Event): void {
    event.preventDefault();
    const value = this.draft().trim();
    if (!value || this.full()) return;
    this.changed.emit([...this.items(), value]);
    this.draft.set('');
  }

  protected remove(index: number): void {
    this.changed.emit(this.items().filter((_, i) => i !== index));
  }
}
