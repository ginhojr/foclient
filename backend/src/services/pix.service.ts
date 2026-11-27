export function buildPixCopyPasteCode(tenantName: string, amount: number, txRef: string): string {
  const cleanName = tenantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 14)
    .padEnd(4, 'X');
  const cents = Math.round(amount * 100)
    .toString()
    .padStart(6, '0');
  const shortRef = txRef.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `00020126580014BR.GOV.BCB.PIX0136foclient-${shortRef}-${cleanName}520400005303986540${cents}5802BR5914${cleanName}6009SAOPAULO6304A9F2`;
}
