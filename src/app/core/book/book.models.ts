/**
 * Modèle d'un livre importé. Le contenu est dérivé du zip officiel Project Aon que le joueur
 * a téléchargé lui-même ; il n'est jamais embarqué dans l'application ni dans le dépôt.
 */

/**
 * Version courante de l'analyse des zips. À incrémenter quand l'analyse conserve du contenu qu'elle
 * perdait avant : la bibliothèque propose alors de réimporter les livres plus anciens.
 * 2 : panneaux et enseignes (div.signpost) conservés.
 */
export const PARSER_VERSION = 2;

export type BookLanguage = 'en' | 'es';

/** Séries de Loup Solitaire : déterminent les règles de création du personnage. */
export type Series = 'kai' | 'magnakai' | 'grandmaster' | 'neworder';

export interface BookMeta {
  /** Code Project Aon du livre, ex. `01fftd`. Clé primaire. */
  id: string;
  number: number;
  title: string;
  authors: string;
  lang: BookLanguage;
  series: Series | null;
  sectionCount: number;
  /** Noms des disciplines tels qu'écrits dans le livre (page `discplnz.htm`). */
  disciplines: string[];
  /**
   * Mots capitalisés qui ne sont pas des objets (créatures, lieux…), pour la détection des objets
   * ramassables. Absent pour les livres importés avant cette fonctionnalité (calculé à la volée).
   */
  nonItemWords?: string[];
  /** Liens d'objets écartés par le joueur (« Pas ramassable ici ») : `<section>|<clé de l'objet>`. */
  dismissedItems?: string[];
  /** Objets déclarés à la main par le joueur (texte non détecté) : `<section>|<nom>`. */
  declaredItems?: string[];
  /** Achats déclarés à la main (ligne de prix non détectée) : `<section>|<prix>|<nom>`. */
  declaredPurchases?: string[];
  /** Pages hors sections disponibles (règles, carte, équipement...), dans l'ordre de la table des matières. */
  pages: PageRef[];
  /** Mention de copyright, affichée sous chaque section (obligation de la licence). */
  copyright: string;
  importedAt: string;
  /** Version de l'analyse du zip ayant produit ce livre (absente = 1) ; voir `PARSER_VERSION`. */
  parserVersion?: number;
}

export interface PageRef {
  id: string;
  title: string;
}

/** Bloc de contenu d'une section ou d'une page, après nettoyage. */
export type Block =
  | { kind: 'html'; html: string }
  | { kind: 'choice'; html: string; target: number }
  | { kind: 'combat'; html: string; enemy: Enemy | null }
  | { kind: 'figure'; image: string }
  | { kind: 'deadend'; html: string };

export interface Enemy {
  name: string;
  combatSkill: number;
  endurance: number;
}

export interface SectionRecord {
  bookId: string;
  number: number;
  blocks: Block[];
}

export interface PageRecord {
  bookId: string;
  id: string;
  title: string;
  blocks: Block[];
}

export interface ImageRecord {
  bookId: string;
  name: string;
  blob: Blob;
}

/** Résultat complet d'un import, prêt à être persisté. */
export interface ParsedBook {
  meta: BookMeta;
  sections: SectionRecord[];
  pages: PageRecord[];
  images: ImageRecord[];
}
