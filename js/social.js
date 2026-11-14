// ------------------------------------------------------------------
//  Friends — a local address book plus the invite links used to pull
//  someone into a named server. Online status comes from the lobby
//  presence channel in net.js.
// ------------------------------------------------------------------

import { storage } from './util.js';
import { state } from './store.js';

const KEY = (uid) => `ironstorm.friends.v1:${uid}`;
const MAX_FRIENDS = 30;

export function normalizeFriend(name) {
  return String(name || '').trim().toUpperCase().slice(0, 16);
}

export function validFriend(name) {
  return /^[A-Z0-9_]{3,16}$/.test(normalizeFriend(name));
}

export function friends(uid = state.uid) {
  if (!uid) return [];
  const list = storage.get(KEY(uid), []);
  return Array.isArray(list) ? list.filter((f) => f && f.name) : [];
}

export function addFriend(name, uid = state.uid) {
  const clean = normalizeFriend(name);
  if (!validFriend(clean)) return { ok: false, why: 'Callsigns are 3-16 letters, numbers or underscores' };
  if (state.profile && clean === normalizeFriend(state.profile.username)) {
    return { ok: false, why: 'That is your own callsign' };
  }
  const list = friends(uid);
  if (list.some((f) => f.name === clean)) return { ok: false, why: 'Already on your list' };
  if (list.length >= MAX_FRIENDS) return { ok: false, why: 'Friend list is full' };
  list.unshift({ name: clean, addedAt: Date.now() });
  storage.set(KEY(uid), list);
  return { ok: true, name: clean };
}

export function removeFriend(name, uid = state.uid) {
  const clean = normalizeFriend(name);
  const list = friends(uid).filter((f) => f.name !== clean);
  storage.set(KEY(uid), list);
  return list;
}

// Online friends, newest sighting first. `lobby` is net.lobby: name -> meta.
export function friendsWithStatus(lobby = new Map(), uid = state.uid) {
  return friends(uid).map((f) => {
    const meta = lobby.get(f.name);
    return {
      ...f,
      online: !!meta,
      room: meta?.room ? { name: meta.roomName || 'ALPHA', mode: meta.mode || 'deathmatch' } : null,
      level: meta?.level || null,
    };
  });
}

export function inviteLink({ room, mode, squad } = {}) {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  if (room) {
    url.searchParams.set('room', room);
    if (mode) url.searchParams.set('mode', mode);
  }
  if (squad) url.searchParams.set('squad', squad);
  return url.toString();
}

export async function copyInvite(link) {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}
