import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TowerWarAi, Difficulty } from '../../core/tower-war/tower-war.ai';
import { TowerWarEngine } from '../../core/tower-war/tower-war.engine';
import { MAPS } from '../../core/tower-war/tower-war.maps';
import { I18nService } from '../../core/i18n/i18n.service';
import { MessageKey } from '../../core/i18n/messages';
import { TopBarComponent } from '../../shared/top-bar.component';
import { TowerWarRenderer, ViewState } from './tower-war.renderer';

type Phase = 'menu' | 'playing' | 'over';

const STEP = 1 / 60;
/** Au-delà, une image très longue (onglet en arrière-plan) ne fait pas avancer la partie d'un bloc. */
const MAX_FRAME = 0.1;

const MAP_LABELS: Record<string, MessageKey> = {
  skirmish: 'tw.map.skirmish',
  crossroads: 'tw.map.crossroads',
  archipelago: 'tw.map.archipelago',
};
const DIFFICULTY_LABELS: Record<Difficulty, MessageKey> = {
  easy: 'tw.level.easy',
  normal: 'tw.level.normal',
  hard: 'tw.level.hard',
};

@Component({
  selector: 'lw-tower-war-page',
  imports: [TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tower-war.page.html',
  styleUrl: './tower-war.page.scss',
})
export class TowerWarPage {
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('board');

  protected readonly maps = MAPS.map((m, index) => ({ index, label: MAP_LABELS[m.id] }));
  protected readonly difficulties = (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((id) => ({
    id,
    label: DIFFICULTY_LABELS[id],
  }));

  protected readonly phase = signal<Phase>('menu');
  protected readonly paused = signal(false);
  protected readonly mapIndex = signal(0);
  protected readonly difficulty = signal<Difficulty>('normal');
  protected readonly winner = signal<'player' | 'ai' | null>(null);
  protected readonly mine = signal(0);
  protected readonly theirs = signal(0);

  private engine = new TowerWarEngine(MAPS[0]);
  private ai: TowerWarAi | null = null;
  private renderer: TowerWarRenderer | null = null;
  private view: ViewState = { dragFrom: null, pointer: null, trail: [] };
  private pointerId: number | null = null;
  private mode: 'link' | 'cut' | null = null;
  private raf = 0;
  private last = 0;
  private accumulator = 0;

  constructor() {
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.raf));
  }

  protected selectMap(index: number): void {
    this.mapIndex.set(index);
    this.engine = new TowerWarEngine(MAPS[index]);
    this.syncCounts();
  }

  protected start(): void {
    this.engine = new TowerWarEngine(MAPS[this.mapIndex()]);
    this.ai = new TowerWarAi(this.engine, this.difficulty());
    this.view = { dragFrom: null, pointer: null, trail: [] };
    this.accumulator = 0;
    this.winner.set(null);
    this.paused.set(false);
    this.phase.set('playing');
    this.syncCounts();
  }

  protected backToMenu(): void {
    this.selectMap(this.mapIndex());
    this.ai = null;
    this.paused.set(false);
    this.winner.set(null);
    this.phase.set('menu');
  }

  protected togglePause(): void {
    if (this.phase() === 'playing') this.paused.update((p) => !p);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.phase() !== 'playing' || this.paused() || this.pointerId !== null || !this.renderer) {
      return;
    }
    const p = this.renderer.toWorld(event.clientX, event.clientY);
    const tower = this.renderer.towerAt(this.engine, p);
    this.pointerId = event.pointerId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.view.pointer = p;
    if (tower?.owner === 'player') {
      this.mode = 'link';
      this.view.dragFrom = tower.id;
    } else {
      this.mode = 'cut';
      this.view.trail = [{ ...p, at: performance.now() }];
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId || !this.renderer) return;
    const p = this.renderer.toWorld(event.clientX, event.clientY);
    if (this.mode === 'cut') {
      const previous = this.view.trail[this.view.trail.length - 1];
      if (previous) this.engine.cutLinks('player', previous, p);
      this.view.trail.push({ ...p, at: performance.now() });
    }
    this.view.pointer = p;
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId || !this.renderer) return;
    if (this.mode === 'link' && this.view.dragFrom !== null) {
      const target = this.renderer.towerAt(
        this.engine,
        this.renderer.toWorld(event.clientX, event.clientY),
      );
      if (target) this.engine.addLink(this.view.dragFrom, target.id, 'player');
    }
    this.endGesture();
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) this.endGesture();
  }

  private endGesture(): void {
    this.pointerId = null;
    this.mode = null;
    this.view.dragFrom = null;
    this.view.pointer = null;
  }

  private init(): void {
    const canvas = this.canvasRef().nativeElement;
    this.renderer = new TowerWarRenderer(canvas);
    this.renderer.resize();
    const observer = new ResizeObserver(() => this.renderer?.resize());
    observer.observe(canvas);
    this.destroyRef.onDestroy(() => observer.disconnect());
    this.syncCounts();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(MAX_FRAME, (now - this.last) / 1000);
    this.last = now;

    if (this.phase() === 'playing' && !this.paused()) {
      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.ai?.update(STEP);
        this.engine.step(STEP);
        this.accumulator -= STEP;
      }
      if (this.engine.winner) {
        this.endGesture();
        this.winner.set(this.engine.winner);
        this.phase.set('over');
      }
      this.syncCounts();
    }

    this.renderer?.absorb(this.engine.drainEvents(), now);
    this.renderer?.draw(this.engine, this.view, now);
  };

  private syncCounts(): void {
    this.mine.set(this.engine.towersOf('player').length);
    this.theirs.set(this.engine.towersOf('ai').length);
  }
}
