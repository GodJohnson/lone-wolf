import { configureItemSizes, itemSize } from './equipment';

const KEY = 'lone-wolf.itemSizes';

/** Tailles d'objets choisies par le joueur (nom en minuscules → places), mémorisées dans ce navigateur. */
export function loadItemSizes(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const out: Record<string, number> = {};
    if (raw && typeof raw === 'object') {
      for (const [name, size] of Object.entries(raw)) {
        if (typeof size === 'number' && Number.isInteger(size) && size >= 1 && size <= 8) {
          out[name.toLowerCase()] = size;
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Applique les tailles mémorisées (à appeler au démarrage). */
export function applyStoredItemSizes(): void {
  configureItemSizes(loadItemSizes());
}

/** Mémorise la taille d'un objet ; une taille égale à celle du livre n'est pas conservée. */
export function setItemSize(name: string, size: number): void {
  const key = name.trim().toLowerCase();
  if (!key || !Number.isInteger(size) || size < 1 || size > 8) return;
  const sizes = loadItemSizes();
  configureItemSizes({ ...sizes, [key]: 0 }); // calcule la taille par défaut, sans l'ancien réglage
  const standard = itemSize(name);
  if (size === standard) delete sizes[key];
  else sizes[key] = size;
  try {
    localStorage.setItem(KEY, JSON.stringify(sizes));
  } catch {
    // Stockage indisponible : la taille vaut pour cette visite seulement.
  }
  configureItemSizes(sizes);
}
