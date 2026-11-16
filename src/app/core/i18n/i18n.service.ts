import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { MessageKey, en, fr } from './messages';

export type UiLanguage = 'fr' | 'en';

const STORAGE_KEY = 'lone-wolf.lang';
const DICTIONARIES: Record<UiLanguage, Record<MessageKey, string>> = { fr, en };

/**
 * Traduction de l'interface, commutable à chaud (signal). Choix volontaire d'un service maison
 * plutôt que de l'i18n compilée d'Angular, qui impose un build et une URL par langue.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  readonly lang = signal<UiLanguage>(this.initialLanguage());
  /**
   * Langue du texte du livre affiché (ex. `en`), ou `null` hors lecture. Quand elle est définie,
   * elle devient la langue du document : les navigateurs mobiles (Chrome, Safari) proposent alors
   * de traduire la page. L'interface est exclue de cette traduction (`translate="no"`).
   */
  readonly contentLang = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.contentLang() ?? this.lang();
    });
    effect(() => {
      const lang = this.lang();
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // Stockage indisponible (navigation privée) : la préférence n'est simplement pas retenue.
      }
    });
  }

  t(key: MessageKey, params?: Record<string, string | number>): string {
    const template = DICTIONARIES[this.lang()][key] ?? key;
    return params
      ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
      : template;
  }

  toggle(): void {
    this.lang.update((l) => (l === 'fr' ? 'en' : 'fr'));
  }

  private initialLanguage(): UiLanguage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'fr' || stored === 'en') return stored;
    } catch {
      // ignore
    }
    return (navigator.language ?? 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }
}
