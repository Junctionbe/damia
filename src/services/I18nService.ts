/**
 * Minimal stub. M7 swaps the implementation for i18next-backed JSON locales.
 * Calling sites use `t(key, params?)`; missing keys fall back to the key itself
 * so untranslated strings are visible in the UI.
 */
const TRANSLATIONS: Record<string, string> = {
  'exits.westPathOvergrown': 'Path overgrown.',
  'exits.demoEndTitle': 'Demo End',
  'exits.demoEndSubtitle': 'Hellena Prison ahead',
  'gameOver.title': 'You died',
  'gameOver.subtitle': 'Press R to restart',
  'items.healingPotion': 'Healing Potion',
  'items.burnOut': 'Burn Out',
  'items.gold': 'Gold',
  'pickups.picked': 'Picked up: {item}',
  'hud.dart': 'DART',
  'zones.forestOfSeles.name': 'Forest of Seles',
  'zones.forestOfSeles.objective': 'Find Hellena Prison',
  'interactables.merchantComingSoon': 'Merchant — Coming soon',
  'log.xpGained': '+{xp} XP',
  'log.itemPicked': 'Picked up: {item}',
};

export function t(key: string, params?: Record<string, string | number>): string {
  const raw = TRANSLATIONS[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
