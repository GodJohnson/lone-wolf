import { fromBase64Url, toBase64Url } from './transfer';

/**
 * Réception sans caméra : l'appareil qui veut recevoir une partie affiche un QR code « réception »
 * ; l'autre le scanne et dépose la partie, chiffrée, sur un relais public (ntfy.sh). Le relais ne
 * voit qu'un message chiffré (AES-GCM) sous un sujet aléatoire ; la clé ne figure que dans le QR code
 * (dans le fragment du lien, jamais envoyé à un serveur).
 */
export const RELAY_URL = 'https://ntfy.sh';

export interface Channel {
  topic: string;
  key: string;
}

const CODE = /^(lw[A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;
/** Limite de message du relais, avec marge. */
const MAX_MESSAGE = 3500;

export function newChannel(): Channel {
  return { topic: 'lw' + toBase64Url(random(16)), key: toBase64Url(random(32)) };
}

export function channelCode(channel: Channel): string {
  return `${channel.topic}.${channel.key}`;
}

export function parseChannelCode(text: string): Channel | null {
  const marker = '#/send/';
  const index = text.indexOf(marker);
  const code = (index >= 0 ? text.slice(index + marker.length) : text).trim().split(/[?\s]/)[0];
  const match = CODE.exec(code);
  return match ? { topic: match[1], key: match[2] } : null;
}

export async function encrypt(channel: Channel, plaintext: string): Promise<string> {
  const iv = random(12);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      await key(channel),
      new TextEncoder().encode(plaintext),
    ),
  );
  const message = new Uint8Array(iv.length + cipher.length);
  message.set(iv);
  message.set(cipher, iv.length);
  return toBase64Url(message);
}

/** Rejette si le message n'a pas été chiffré avec cette clé (ou a été altéré). */
export async function decrypt(channel: Channel, message: string): Promise<string> {
  const bytes = fromBase64Url(message);
  if (bytes.length < 13) throw new Error('invalid');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) as BufferSource },
    await key(channel),
    bytes.slice(12) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export async function publish(channel: Channel, plaintext: string): Promise<void> {
  const body = await encrypt(channel, plaintext);
  if (body.length > MAX_MESSAGE) throw new Error('tooBig');
  const response = await fetch(`${RELAY_URL}/${channel.topic}`, { method: 'POST', body });
  if (!response.ok) throw new Error('relay');
}

/**
 * Attend un message sur le canal (une seule connexion SSE : le relais limite le nombre de requêtes).
 * Retourne la fonction d'arrêt.
 */
export function subscribe(
  channel: Channel,
  onMessage: (plaintext: string) => void,
  onError: () => void,
): () => void {
  const source = new EventSource(`${RELAY_URL}/${channel.topic}/sse?since=all`);
  let done = false;
  source.addEventListener('message', async (event) => {
    if (done) return;
    try {
      const data = JSON.parse((event as MessageEvent<string>).data) as { message?: unknown };
      if (typeof data.message !== 'string') return;
      const plaintext = await decrypt(channel, data.message);
      done = true;
      source.close();
      onMessage(plaintext);
    } catch {
      // Message étranger ou altéré : ignoré, on continue d'attendre.
    }
  });
  source.addEventListener('error', () => {
    if (source.readyState === EventSource.CLOSED && !done) onError();
  });
  return () => {
    done = true;
    source.close();
  };
}

async function key(channel: Channel): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    fromBase64Url(channel.key) as BufferSource,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}

function random(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}
