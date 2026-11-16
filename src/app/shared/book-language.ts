import { DestroyRef, effect, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/**
 * Déclare la langue du livre affiché pendant la vie du composant appelant, pour que le
 * navigateur propose de traduire le texte (voir `I18nService.contentLang`).
 */
export function useBookLanguage(lang: () => string | undefined): void {
  const i18n = inject(I18nService);
  effect(() => i18n.contentLang.set(lang() ?? null));
  inject(DestroyRef).onDestroy(() => i18n.contentLang.set(null));
}
