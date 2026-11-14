// ------------------------------------------------------------------
//  Cosmetics — the post-garage sink. Paid for with salvage earned in
//  battle and on the medal board, so it stays useful after every tank
//  has been requisitioned. Emblems and trails are drawn on canvas.
// ------------------------------------------------------------------

export const COSMETIC_KINDS = {
  emblem: { label: 'HULL EMBLEM', sub: 'Painted on your turret, visible to every commander in the arena' },
  trail: { label: 'SHELL TRAIL', sub: 'The tracer colour left by your main gun' },
  killfx: { label: 'KILL EFFECT', sub: 'The burst that marks a kill you made' },
};

export const COSMETIC_ITEMS = [
  // emblems
  { key: 'emblem:none', kind: 'emblem', id: 'none', name: 'NO EMBLEM', price: 0, glyph: '—', blurb: 'Bare armour. Standard issue.' },
  { key: 'emblem:star', kind: 'emblem', id: 'star', name: 'IRON STAR', price: 0, glyph: '★', blurb: 'The corps star, free to every commander.' },
  { key: 'emblem:chevron', kind: 'emblem', id: 'chevron', name: 'CHEVRONS', price: 180, glyph: '⌃', blurb: 'Two chevrons for the front line.' },
  { key: 'emblem:skull', kind: 'emblem', id: 'skull', name: "DEATH'S HEAD", price: 320, glyph: '☠', blurb: 'A warning to anyone in the open.' },
  { key: 'emblem:bolt', kind: 'emblem', id: 'bolt', name: 'LIGHTNING', price: 450, glyph: 'ϟ', blurb: 'Fast armour, faster reputation.' },
  { key: 'emblem:laurel', kind: 'emblem', id: 'laurel', name: 'LAUREL', price: 620, glyph: '❧', blurb: 'For commanders who win with style.' },
  { key: 'emblem:anchor', kind: 'emblem', id: 'anchor', name: 'ANCHOR', price: 800, glyph: '⚓', blurb: 'Hold the line, whatever the tide.' },
  { key: 'emblem:crown', kind: 'emblem', id: 'crown', name: 'IRON CROWN', price: 1050, glyph: '♛', blurb: "Reserved for the sector's worst problem." },
  // trails
  { key: 'trail:none', kind: 'trail', id: 'none', name: 'STANDARD TRACER', price: 0, glyph: '—', blurb: 'The factory tracer round.' },
  { key: 'trail:smoke', kind: 'trail', id: 'smoke', name: 'SMOKE', price: 220, glyph: '≋', blurb: 'A grey wake that hangs in the air.' },
  { key: 'trail:ember', kind: 'trail', id: 'ember', name: 'EMBER', price: 380, glyph: '✷', blurb: 'Burning sparks behind every shell.' },
  { key: 'trail:toxic', kind: 'trail', id: 'toxic', name: 'TOXIC', price: 540, glyph: '☣', blurb: 'Chemical green. Probably illegal.' },
  { key: 'trail:gilded', kind: 'trail', id: 'gilded', name: 'GILDED', price: 880, glyph: '✦', blurb: 'Gold tracers for expensive taste.' },
  // kill effects
  { key: 'killfx:none', kind: 'killfx', id: 'none', name: 'STANDARD BLAST', price: 0, glyph: '—', blurb: 'The usual fireball.' },
  { key: 'killfx:ring', kind: 'killfx', id: 'ring', name: 'SHOCK RING', price: 300, glyph: '◎', blurb: 'A clean expanding ring of pressure.' },
  { key: 'killfx:shards', kind: 'killfx', id: 'shards', name: 'SHRAPNEL', price: 520, glyph: '✳', blurb: 'A burst of jagged steel.' },
  { key: 'killfx:nova', kind: 'killfx', id: 'nova', name: 'IRON NOVA', price: 900, glyph: '✺', blurb: 'A double ring and a white-hot core.' },
];

export const COSMETIC_KEYS_BASE = ['emblem:none', 'emblem:star', 'trail:none', 'killfx:none'];

export const TRAILS = {
  none: { color: null, glyph: '—' },
  smoke: { color: 'rgba(198, 204, 190, 0.55)', glyph: '≋' },
  ember: { color: 'rgba(255, 150, 66, 0.8)', glyph: '✷' },
  toxic: { color: 'rgba(166, 240, 92, 0.8)', glyph: '☣' },
  gilded: { color: 'rgba(240, 205, 110, 0.85)', glyph: '✦' },
};

export const EMBLEMS = {
  none: { glyph: '—' },
  star: { glyph: '★' },
  chevron: { glyph: '⌃' },
  skull: { glyph: '☠' },
  bolt: { glyph: 'ϟ' },
  laurel: { glyph: '❧' },
  anchor: { glyph: '⚓' },
  crown: { glyph: '♛' },
};

export const cosmeticById = (kind, id) => COSMETIC_ITEMS.find((c) => c.kind === kind && c.id === id) || null;
export const cosmeticsOfKind = (kind) => COSMETIC_ITEMS.filter((c) => c.kind === kind);

export function ownsCosmetic(local, kind, id) {
  const key = `${kind}:${id}`;
  if (COSMETIC_KEYS_BASE.includes(key)) return true;
  return !!local?.cosmetics?.owned?.includes(key);
}

export function equippedCosmetic(local, kind) {
  return local?.cosmetics?.[kind] || 'none';
}

export function buyCosmeticLocal(local, kind, id) {
  const item = cosmeticById(kind, id);
  if (!item) return { ok: false, why: 'Unknown item' };
  if (ownsCosmetic(local, kind, id)) return { ok: false, why: 'Already owned' };
  if ((local.salvage | 0) < item.price) return { ok: false, why: 'Not enough salvage' };
  local.salvage = (local.salvage | 0) - item.price;
  local.cosmetics.owned.push(item.key);
  local.cosmetics[kind] = id;
  return { ok: true };
}

export function equipCosmeticLocal(local, kind, id) {
  if (!ownsCosmetic(local, kind, id)) return { ok: false, why: 'Not owned' };
  local.cosmetics[kind] = id;
  return { ok: true };
}

// Canvas emblem, drawn around (0,0) in world space.
export function drawEmblem(ctx, id, size = 15, color = 'rgba(240, 248, 226, 0.9)') {
  if (!id || id === 'none') return;
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, s * 0.12);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s * 0.5 : s * 0.21;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'chevron':
      for (let i = 0; i < 2; i++) {
        const y = -s * 0.22 + i * s * 0.34;
        ctx.beginPath();
        ctx.moveTo(-s * 0.32, y + s * 0.12);
        ctx.lineTo(0, y - s * 0.12);
        ctx.lineTo(s * 0.32, y + s * 0.12);
        ctx.stroke();
      }
      break;
    case 'skull':
      ctx.beginPath();
      ctx.arc(0, -s * 0.08, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b120b';
      ctx.beginPath();
      ctx.arc(-s * 0.11, -s * 0.12, s * 0.06, 0, Math.PI * 2);
      ctx.arc(s * 0.11, -s * 0.12, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(-s * 0.12, s * 0.19, s * 0.24, s * 0.09);
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.45);
      ctx.lineTo(s * 0.28, -s * 0.06);
      ctx.lineTo(s * 0.04, -s * 0.02);
      ctx.lineTo(s * 0.16, s * 0.45);
      ctx.lineTo(-s * 0.3, s * 0.02);
      ctx.lineTo(-s * 0.04, -s * 0.03);
      ctx.closePath();
      ctx.fill();
      break;
    case 'laurel':
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.36, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.36, Math.PI * 1.65, Math.PI * 2.35);
      ctx.stroke();
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const a = dir > 0 ? Math.PI * (0.72 + i * 0.13) : Math.PI * (1.28 - i * 0.13);
          const x = Math.cos(a) * s * 0.32, y = s * 0.05 + Math.sin(a) * s * 0.32;
          ctx.beginPath();
          ctx.ellipse(x, y, s * 0.09, s * 0.04, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case 'anchor':
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.34); ctx.lineTo(0, s * 0.34);
      ctx.moveTo(-s * 0.22, -s * 0.2); ctx.lineTo(s * 0.22, -s * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.12, s * 0.24, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, s * 0.2);
      ctx.lineTo(-s * 0.32, -s * 0.24);
      ctx.lineTo(-s * 0.1, s * 0.02);
      ctx.lineTo(0, -s * 0.34);
      ctx.lineTo(s * 0.1, s * 0.02);
      ctx.lineTo(s * 0.32, -s * 0.24);
      ctx.lineTo(s * 0.4, s * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}
