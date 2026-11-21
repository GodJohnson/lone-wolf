import { Enemy } from '../book/book.models';

export interface Character {
  combatSkill: number;
  endurance: number;
  enduranceMax: number;
  disciplines: string[];
  /** Arme maîtrisée (discipline Weaponskill / Maîtrise des armes). */
  weaponskill: string | null;
  weapons: string[];
  backpack: string[];
  specialItems: string[];
  gold: number;
  meals: number;
  notes: string;
  /** Objets, or et Repas mis de côté (confisqués, laissés en route) : ne comptent plus, mais restent récupérables. */
  stash?: Stash;
}

export interface Stash {
  weapons: string[];
  backpack: string[];
  specialItems: string[];
  gold: number;
  meals: number;
}

export interface CombatRound {
  roll: number;
  ratio: number;
  enemyLoss: number | 'K';
  playerLoss: number | 'K';
  enemyEndurance: number;
  playerEndurance: number;
  evaded: boolean;
}

export interface CombatState {
  section: number;
  /** Index du bloc combat dans la section (plusieurs ennemis possibles). */
  blockIndex: number;
  enemy: Enemy;
  enemyEndurance: number;
  /** Modificateur de circonstance saisi par le joueur (ex. -1 dans la section 17). */
  modifier: number;
  useMindblast: boolean;
  /** Ennemi mort-vivant : l'Épée de Sommer double ses pertes d'ENDURANCE. */
  undead?: boolean;
  rounds: CombatRound[];
  outcome: 'ongoing' | 'won' | 'lost' | 'evaded';
}

export interface GameState {
  bookId: string;
  section: number;
  /** Sections parcourues dans l'ordre (permet le retour arrière). */
  history: number[];
  character: Character;
  combat: CombatState | null;
  /** Sections où un combat a été mené (pour la règle de Guérison). */
  foughtIn: number[];
  /** Le Repas imposé par la section courante a été réglé (remis à faux à chaque changement de section). */
  mealResolved?: boolean;
  /** Le joueur a terminé ce livre (bouton « Terminer le livre » en fin de livre). */
  finished?: boolean;
  /** Événements du récit déjà survenus (ex. le jeton de la salle de jeu, remis une seule fois). */
  flags?: string[];
  createdAt: string;
  updatedAt: string;
}
