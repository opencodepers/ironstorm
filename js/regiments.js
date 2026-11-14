// ------------------------------------------------------------------
//  IronStorm — regiments
//  A regiment is a persistent identity carried into every arena through
//  the room/lobby presence metadata. It needs no database: the code is
//  the enlistment token, and the roster is everyone currently carrying it.
// ------------------------------------------------------------------

import { storage } from './util.js';

const KEY = (uid) => `ironstorm.regiment.v1:${uid || 'local'}`;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REGIMENT_COLORS = ['#8fe86b', '#7fb0d0', '#e8c96a', '#c8a0ff', '#e0806a', '#7fd8d0'];

export const validTag = (tag) => /^[A-Z0-9]{2,5}$/.test(String(tag || '').toUpperCase());
export const validName = (name) => /^[A-Z0-9 _-]{3,24}$/.test(String(name || '').toUpperCase());

export function myRegiment(uid) {
  const raw = storage.get(KEY(uid), null);
  return raw && typeof raw === 'object' && raw.code ? raw : null;
}

// Cache a server-authoritative regiment locally so menu paint stays instant.
export function adoptRegiment(reg, uid) {
  if (!reg?.code) return null;
  storage.set(KEY(uid), reg);
  return reg;
}

export function createRegiment({ name, tag, color, motto } = {}, uid, owner) {
  const cleanName = String(name || '').trim().toUpperCase().slice(0, 24);
  const cleanTag = String(tag || '').trim().toUpperCase().slice(0, 5);
  if (!validName(cleanName)) return { ok: false, why: 'Regiment names are 3-24 letters, numbers, spaces, _ or -' };
  if (!validTag(cleanTag)) return { ok: false, why: 'Tags are 2-5 letters or numbers' };
  let code = '';
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const reg = {
    code,
    name: cleanName,
    tag: cleanTag,
    color: REGIMENT_COLORS.includes(color) ? color : REGIMENT_COLORS[0],
    motto: String(motto || 'HOLD THE LINE').toUpperCase().slice(0, 40),
    owner: owner || 'COMMANDER',
    createdAt: Date.now(),
    open: true,
  };
  storage.set(KEY(uid), reg);
  return { ok: true, regiment: reg };
}

export function updateRegiment(patch = {}, uid) {
  const reg = myRegiment(uid);
  if (!reg) return { ok: false, why: 'Create a regiment first' };
  const next = {
    ...reg,
    name: patch.name != null ? String(patch.name).toUpperCase().slice(0, 24) : reg.name,
    tag: patch.tag != null ? String(patch.tag).toUpperCase().slice(0, 5) : reg.tag,
    color: REGIMENT_COLORS.includes(patch.color) ? patch.color : reg.color,
    motto: patch.motto != null ? String(patch.motto).toUpperCase().slice(0, 40) : reg.motto,
    open: patch.open != null ? !!patch.open : reg.open,
  };
  if (!validName(next.name) || !validTag(next.tag)) return { ok: false, why: 'Invalid regiment name or tag' };
  storage.set(KEY(uid), next);
  return { ok: true, regiment: next };
}

export function joinRegiment(code, meta = {}, uid) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(clean)) return { ok: false, why: 'Regiment codes are 5 letters or numbers' };
  const reg = {
    code: clean,
    name: String(meta.name || `REGIMENT ${clean}`).toUpperCase().slice(0, 24),
    tag: String(meta.tag || clean.slice(0, 3)).toUpperCase().slice(0, 5),
    color: REGIMENT_COLORS.includes(meta.color) ? meta.color : REGIMENT_COLORS[0],
    motto: String(meta.motto || 'HOLD THE LINE').toUpperCase().slice(0, 40),
    owner: String(meta.owner || 'FIELD COMMAND').toUpperCase().slice(0, 16),
    createdAt: Date.now(),
    open: true,
  };
  storage.set(KEY(uid), reg);
  return { ok: true, regiment: reg };
}

export function leaveRegiment(uid) {
  storage.remove(KEY(uid));
}

export function regimentInvite(reg) {
  if (!reg) return '';
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('reg', reg.code);
  url.searchParams.set('rtag', reg.tag);
  url.searchParams.set('rname', reg.name);
  return url.toString();
}

export function regimentMembers(lobby, reg, profile, remoteRows = []) {
  const members = new Map();
  for (const row of remoteRows || []) {
    const name = String(row?.name || '').toUpperCase();
    if (!name) continue;
    members.set(name, {
      name,
      level: row.level | 0,
      wp: 0,
      room: '',
      online: false,
      rank: row.role || '',
    });
  }
  if (lobby && typeof lobby.values === 'function') {
    for (const meta of lobby.values()) {
      if (!meta?.name || meta.reg !== reg?.code) continue;
      members.set(String(meta.name).toUpperCase(), {
        ...(members.get(String(meta.name).toUpperCase()) || {}),
        name: String(meta.name).toUpperCase(),
        level: meta.level | 0,
        wp: meta.wp | 0,
        room: meta.roomName || '',
        online: true,
        rank: meta.rank || members.get(String(meta.name).toUpperCase())?.rank || '',
      });
    }
  }
  if (profile?.username) {
    const me = String(profile.username).toUpperCase();
    members.set(me, {
      ...(members.get(me) || {}),
      name: me,
      level: profile.level | 0,
      wp: members.get(me)?.wp || 0,
      room: '',
      online: true,
      you: true,
    });
  }
  return [...members.values()].sort((a, b) => b.wp - a.wp || a.name.localeCompare(b.name));
}
