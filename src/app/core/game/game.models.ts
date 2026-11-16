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
  createdAt: string;
  updatedAt: string;
}
