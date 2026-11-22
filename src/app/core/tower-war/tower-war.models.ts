/** Modèle de la Guerre des tours : état pur, sans dépendance à Angular ni au DOM. */

export type Side = 'player' | 'ai';
export type Owner = Side | 'neutral';

/** Dimensions du monde (portrait, mobile-first). Les coordonnées de tout le jeu sont dans ce repère. */
export const WORLD = { width: 100, height: 150 } as const;

/** Garnison minimale pour atteindre le niveau 1, 2 et 3. Un niveau perdu se regagne en regarnissant. */
export const LEVEL_THRESHOLDS = [0, 15, 35] as const;
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;
/** Plafond de garnison (l'affichage tient sur deux chiffres) : au-delà, les renforts sont perdus. */
export const MAX_GARRISON = 99;
/** Cadence d'émission d'un lien : une unité par seconde. */
export const LINK_RATE = 1;
/** Vitesse de déplacement d'une unité, en unités du monde par seconde. */
export const UNIT_SPEED = 22;
/** Force et résistance d'une unité (1 pour le moment : deux unités adverses qui se croisent meurent). */
export const UNIT_POWER = 1;
export const UNIT_HP = 1;

export interface Unit {
  owner: Side;
  /** Avancement le long du lien, de 0 (tour source) à 1 (tour cible). */
  progress: number;
  hp: number;
  power: number;
}

export interface Tower {
  id: number;
  x: number;
  y: number;
  owner: Owner;
  garrison: number;
  /** Fraction d'unité générée mais pas encore ajoutée à la garnison. */
  genAcc: number;
}

export interface Link {
  id: number;
  from: number;
  to: number;
  length: number;
  /** Temps accumulé avant la prochaine émission, plafonné à 1/LINK_RATE tant que la garnison est vide. */
  emitAcc: number;
  /** Unités en transit, la plus avancée en premier. */
  units: Unit[];
  alive: boolean;
}

export interface TowerSpec {
  x: number;
  y: number;
  owner: Owner;
  garrison: number;
}

export interface MapDef {
  id: string;
  towers: TowerSpec[];
}

export type EngineEvent =
  { kind: 'clash'; x: number; y: number } | { kind: 'capture'; x: number; y: number; owner: Side };

export function otherSide(side: Side): Side {
  return side === 'player' ? 'ai' : 'player';
}

/** Niveau d'une tour (1 à 3) d'après sa garnison. */
export function levelOf(garrison: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (garrison >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}
