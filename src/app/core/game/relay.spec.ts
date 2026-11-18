import { channelCode, decrypt, encrypt, newChannel, parseChannelCode } from './relay';

describe('relay', () => {
  it('chiffre puis déchiffre, avec accents', async () => {
    const channel = newChannel();
    const message = await encrypt(channel, 'Clé sous la pierre é — 197');
    expect(message).not.toContain('pierre');
    expect(await decrypt(channel, message)).toBe('Clé sous la pierre é — 197');
  });

  it('refuse un autre canal et un message altéré', async () => {
    const message = await encrypt(newChannel(), 'secret');
    await expect(decrypt(newChannel(), message)).rejects.toBeDefined();
    const channel = newChannel();
    const good = await encrypt(channel, 'secret');
    const tampered = good.slice(0, -2) + (good.endsWith('AA') ? 'BB' : 'AA');
    await expect(decrypt(channel, tampered)).rejects.toBeDefined();
    await expect(decrypt(channel, 'court')).rejects.toBeDefined();
  });

  it('chaque message a un IV différent', async () => {
    const channel = newChannel();
    expect(await encrypt(channel, 'x')).not.toBe(await encrypt(channel, 'x'));
  });

  it('code de canal : aller-retour, lien complet, rejet du reste', () => {
    const channel = newChannel();
    const code = channelCode(channel);
    expect(parseChannelCode(code)).toEqual(channel);
    expect(parseChannelCode(`https://x.test/lone-wolf/#/send/${code}`)).toEqual(channel);
    for (const bad of [
      '',
      'abc',
      code + 'x',
      code.replace('lw', 'zz'),
      'lw' + 'a'.repeat(22) + '.short',
    ]) {
      expect(parseChannelCode(bad)).toBeNull();
    }
  });
});
