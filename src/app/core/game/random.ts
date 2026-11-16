/** Tirage dans la Table de hasard : entier uniforme de 0 à 9 (crypto, sans biais de modulo). */
export function randomNumber(): number {
  const buffer = new Uint8Array(1);
  // 250 est le plus grand multiple de 10 ≤ 256 : on rejette 250-255 pour rester uniforme.
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= 250);
  return buffer[0] % 10;
}
