/** QR code en image (data URL), bibliothèque chargée à la demande. */
export async function qrDataUrl(text: string): Promise<string> {
  // Module CommonJS : selon le bundler, les fonctions sont sur le module ou sur `default`.
  const mod = await import('qrcode');
  const QRCode = mod.default ?? mod;
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'L', margin: 2, width: 320 });
}
