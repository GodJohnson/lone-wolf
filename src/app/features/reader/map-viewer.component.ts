import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { BookRepository } from '../../core/book/book-repository';
import { MAP_IMAGE, findPlace } from '../../core/game/places';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Carte du livre en plein écran, sans quitter la section : zoom, défilement, et épingle sur le lieu
 * demandé. Un lieu inconnu se place d'un toucher sur la carte (épingle mémorisée pour le livre).
 */
@Component({
  selector: 'lw-map-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map-viewer" role="dialog" aria-modal="true" [attr.aria-label]="i18n.t('map.title')">
      <header class="map-viewer__bar">
        <strong> 🗺 {{ place() ? place() : i18n.t('map.title') }} </strong>
        <span class="map-viewer__zoom">
          <button type="button" class="icon-button" aria-label="−" (click)="zoomBy(-0.5)">−</button>
          <button type="button" class="icon-button" aria-label="+" (click)="zoomBy(0.5)">+</button>
        </span>
        <button type="button" class="button button--small" (click)="closed.emit()">
          {{ i18n.t('common.close') }}
        </button>
      </header>

      @if (place()) {
        <p class="map-viewer__hint small">
          @if (placing()) {
            {{ i18n.t('map.placeHint', { name: place()! }) }}
          } @else if (!position()) {
            {{ i18n.t('map.unknown', { name: place()! }) }}
          } @else {
            <button
              type="button"
              class="button button--ghost button--small"
              (click)="placing.set(true)"
            >
              {{ i18n.t('map.move') }}
            </button>
          }
          @if (declarable()) {
            <button type="button" class="button button--small" (click)="declared.emit()">
              🔗 {{ i18n.t('map.link') }}
            </button>
          }
        </p>
      }

      <div class="map-viewer__scroll" #scroller>
        @if (image.value(); as src) {
          <div
            class="map-viewer__canvas"
            [class.map-viewer__canvas--placing]="placing()"
            [style.width.%]="zoom() * 100"
            (click)="tap($event)"
          >
            <img [src]="src" alt="" (load)="centerOnPlace()" draggable="false" />
            @if (position(); as pos) {
              <span
                class="map-viewer__pin"
                [style.left.%]="pos.x * 100"
                [style.top.%]="pos.y * 100"
                aria-hidden="true"
                >📍</span
              >
            }
          </div>
        } @else if (image.isLoading()) {
          <p class="muted center">{{ i18n.t('common.loading') }}</p>
        } @else {
          <p class="notice">{{ i18n.t('map.missing') }}</p>
        }
      </div>
    </div>
  `,
})
export class MapViewerComponent {
  protected readonly i18n = inject(I18nService);
  private readonly books = inject(BookRepository);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  readonly bookId = input.required<string>();
  /** Lieu à repérer ; `null` pour la carte seule. */
  readonly place = input<string | null>(null);
  /** Épingles du joueur (`<nom>|<x>|<y>`). */
  readonly pins = input<readonly string[]>([]);
  /** Le lieu vient d'une sélection manuelle : proposer d'en faire un lien dans la section. */
  readonly declarable = input(false);
  readonly closed = output<void>();
  /** Épingle posée par le joueur (fractions de l'image). */
  readonly pinned = output<{ name: string; x: number; y: number }>();
  /** « Lier ce lieu dans la section ». */
  readonly declared = output<void>();

  protected readonly zoom = signal(1);
  protected readonly placing = signal(false);
  protected readonly image = resource({
    params: () => this.bookId(),
    loader: ({ params }) => this.books.imageUrl(params, MAP_IMAGE),
  });
  protected readonly position = computed(() => {
    const name = this.place();
    return name ? findPlace(this.bookId(), name, this.pins()) : null;
  });

  constructor() {
    // Lieu inconnu : on invite directement à le placer.
    effect(() => this.placing.set(!!this.place() && !this.position()));
    // Arrivée sur un lieu : zoom ×2 pour le voir de près.
    effect(() => {
      if (this.position()) this.zoom.set(2);
    });
    effect(() => {
      this.zoom();
      requestAnimationFrame(() => this.centerOnPlace());
    });
  }

  protected zoomBy(delta: number): void {
    this.zoom.update((z) => Math.min(4, Math.max(1, z + delta)));
  }

  /** Centre l'affichage sur l'épingle (zoom 2 d'office quand on arrive sur un lieu). */
  protected centerOnPlace(): void {
    const pos = this.position();
    const box = this.scroller()?.nativeElement;
    if (!pos || !box) return;
    box.scrollLeft = pos.x * box.scrollWidth - box.clientWidth / 2;
    box.scrollTop = pos.y * box.scrollHeight - box.clientHeight / 2;
  }

  protected tap(event: MouseEvent): void {
    const name = this.place();
    if (!this.placing() || !name) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    this.placing.set(false);
    this.pinned.emit({ name, x, y });
  }
}
