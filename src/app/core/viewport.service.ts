import { Injectable, signal } from '@angular/core';

/** Largeur à partir de laquelle l'appli passe en mise en page « bureau » (3 colonnes). */
export const DESKTOP_QUERY = '(min-width: 1024px)';

@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly _desktop = signal(false);
  readonly desktop = this._desktop.asReadonly();

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(DESKTOP_QUERY);
    this._desktop.set(query.matches);
    query.addEventListener('change', (e) => this._desktop.set(e.matches));
  }
}
