import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SB_URL, SB_KEY, NET, PALETTE } from '../../js/config.js';

const CHANNEL_PREFIX = 'ironstorm-tanklab-v1';
const MAX_PLAYERS = 12;
const SEND_INTERVAL = 1000 / (NET?.sendHz || 10);
const PEER_TIMEOUT = 12000;
const DEFAULT_ROOM = 'RANGE';
const DEFAULT_ACCENT = '#d36f3b';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrapAngle = (angle) => {
  let wrapped = (angle + Math.PI) % (Math.PI * 2);
  if (wrapped < 0) wrapped += Math.PI * 2;
  return wrapped - Math.PI;
};
const cleanText = (value, max = 16) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const params = new URLSearchParams(window.location.search);
const requestedRoom = params.get('room') || DEFAULT_ROOM;
const room = cleanText(requestedRoom, 16) || DEFAULT_ROOM;
const roomSlug = room.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'range';

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing can block storage; the range still works.
  }
}

const uid = (() => {
  const existing = readStorage(window.sessionStorage, 'ironstorm.tankLab.netId');
  if (existing) return existing;
  const next = globalThis.crypto?.randomUUID?.()
    || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  writeStorage(window.sessionStorage, 'ironstorm.tankLab.netId', next);
  return next;
})();

const callsign = (() => {
  const requested = cleanText(params.get('name') || '', 16);
  if (requested) {
    writeStorage(window.localStorage, 'ironstorm.tankLab.callsign', requested);
    return requested;
  }
  const remembered = cleanText(readStorage(window.localStorage, 'ironstorm.tankLab.callsign') || '', 16);
  if (remembered) return remembered;
  const fallback = `CMD-${uid.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`;
  writeStorage(window.localStorage, 'ironstorm.tankLab.callsign', fallback);
  return fallback;
})();

function accentFor(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return PALETTE[(hash >>> 0) % PALETTE.length] || DEFAULT_ACCENT;
}

function makeNameTexture(name, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 512, 128);
  context.fillStyle = 'rgba(12, 16, 11, 0.78)';
  context.fillRect(8, 8, 496, 112);
  context.fillStyle = accent;
  context.fillRect(8, 8, 10, 112);
  context.strokeStyle = 'rgba(231, 161, 114, 0.42)';
  context.lineWidth = 2;
  context.strokeRect(8, 8, 496, 112);
  context.fillStyle = '#edf0e3';
  context.font = '700 46px "Arial Narrow", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name.slice(0, 16), 285, 54);
  context.fillStyle = 'rgba(237, 240, 227, 0.46)';
  context.font = '500 18px "Consolas", monospace';
  context.fillText('RANGE LINK', 285, 91);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Shared geometry keeps each remote tank to three inexpensive body draw calls.
const HULL_GEOMETRY = mergeGeometries([
  new THREE.BoxGeometry(3.35, 0.95, 7.1).translate(0, 0.88, 0),
  new THREE.BoxGeometry(3.25, 0.4, 1.7).translate(0, 1.06, -3.0),
  new THREE.BoxGeometry(0.62, 0.58, 7.3).translate(-1.42, 0.39, 0),
  new THREE.BoxGeometry(0.62, 0.58, 7.3).translate(1.42, 0.39, 0),
]);
const TURRET_GEOMETRY = new THREE.CylinderGeometry(1.15, 1.4, 0.7, 10);
const BARREL_GEOMETRY = new THREE.CylinderGeometry(0.09, 0.12, 4.1, 7)
  .rotateX(Math.PI / 2)
  .translate(0, 0, -2.05);

function makeProxy(name, accent) {
  const color = new THREE.Color(accent);
  const hullColor = new THREE.Color(0x3d4837).lerp(color, 0.16);
  const turretColor = new THREE.Color(0x44513d).lerp(color, 0.24);
  const hullMaterial = new THREE.MeshStandardMaterial({
    color: hullColor,
    roughness: 0.84,
    metalness: 0.24,
  });
  const turretMaterial = new THREE.MeshStandardMaterial({
    color: turretColor,
    roughness: 0.8,
    metalness: 0.28,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e241c,
    roughness: 0.9,
    metalness: 0.34,
  });

  const group = new THREE.Group();
  group.name = `remote-tank-${name}`;

  const hull = new THREE.Mesh(HULL_GEOMETRY, hullMaterial);
  hull.receiveShadow = true;
  group.add(hull);

  const turret = new THREE.Group();
  turret.position.set(0, 1.62, 0.15);
  const turretMesh = new THREE.Mesh(TURRET_GEOMETRY, turretMaterial);
  turretMesh.receiveShadow = true;
  turret.add(turretMesh);

  const barrel = new THREE.Group();
  const barrelMesh = new THREE.Mesh(BARREL_GEOMETRY, darkMaterial);
  barrelMesh.position.y = 0.1;
  barrel.add(barrelMesh);
  turret.add(barrel);
  group.add(turret);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });

  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeNameTexture(name, accent),
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  }));
  label.position.set(0, 4.0, 0);
  label.scale.set(6.3, 1.58, 1);
  label.renderOrder = 8;
  group.add(label);

  group.visible = false;
  return {
    group,
    turret,
    barrel,
    label,
    hullMaterial,
    turretMaterial,
    darkMaterial,
    accent,
  };
}

function publish(force = false) {
  const names = [...new Set([
    ...presenceNames.values(),
    ...[...peers.values()].map((peer) => peer.name),
  ])].slice(0, MAX_PLAYERS - 1);
  const count = Math.max(1, presenceCount, peers.size + 1);
  const key = [status, count, peers.size, names.join('|')].join('~');
  if (!force && key === lastPublished) return;
  lastPublished = key;
  try {
    onChange?.({
      status,
      online: status === 'online',
      room,
      callsign,
      count,
      max: MAX_PLAYERS,
      remotes: peers.size,
      roster: names,
    });
  } catch {
    // A UI callback must not take the range down.
  }
}

function removePeer(id) {
  const peer = peers.get(id);
  if (!peer) return;
  scene.remove(peer.group);
  peer.label.material.map?.dispose();
  peer.label.material.dispose();
  peer.hullMaterial.dispose();
  peer.turretMaterial.dispose();
  peer.darkMaterial.dispose();
  peers.delete(id);
}

function setName(peer, name) {
  const next = cleanText(name, 16) || peer.name;
  if (next === peer.name) return;
  peer.name = next;
  peer.group.name = `remote-tank-${next}`;
  const texture = makeNameTexture(next, peer.accent);
  peer.label.material.map?.dispose();
  peer.label.material.map = texture;
  peer.label.material.needsUpdate = true;
}

function consumeState(payload) {
  if (!payload?.i || payload.i === uid || disposed) return;
  receivedStates += 1;
  if (status !== 'online') {
    status = 'online';
    clearTimeout(connectTimer);
  }

  const id = String(payload.i);
  let peer = peers.get(id);
  const name = cleanText(payload.n, 16) || 'COMMANDER';
  if (!peer) {
    const accent = accentFor(id);
    peer = { ...makeProxy(name, accent), name, accent, target: null, ready: false };
    peers.set(id, peer);
    scene.add(peer.group);
    publish();
  } else {
    setName(peer, name);
  }

  const x = Number(payload.x);
  const y = Number(payload.y);
  const z = Number(payload.z);
  if (![x, y, z].every(Number.isFinite)) return;

  peer.target = {
    x,
    y,
    z,
    heading: Number.isFinite(Number(payload.h)) ? Number(payload.h) : 0,
    turretYaw: Number.isFinite(Number(payload.ty)) ? Number(payload.ty) : 0,
    gunPitch: clamp(Number(payload.gp) || 0, -0.2, 0.35),
  };
  peer.lastSeen = performance.now();

  if (!peer.ready) {
    peer.ready = true;
    peer.group.visible = true;
    peer.group.position.set(peer.target.x, peer.target.y, peer.target.z);
    peer.group.rotation.y = peer.target.heading;
    peer.turret.rotation.y = peer.target.turretYaw;
    peer.barrel.rotation.x = peer.target.gunPitch;
  }
}

function syncPresence() {
  presenceNames.clear();
  presenceCount = 1;
  try {
    const state = channel?.presenceState?.() || {};
    let total = 0;
    for (const [key, entries] of Object.entries(state)) {
      if (!entries?.length) continue;
      total += 1;
      if (key === uid) continue;
      const meta = entries[0];
      if (meta?.name) presenceNames.set(key, cleanText(meta.name, 16));
    }
    presenceCount = Math.max(1, total);
  } catch {
    // Presence is an enhancement; broadcast state still drives the proxies.
  }
  const known = new Set([uid, ...presenceNames.keys(), ...peers.keys()]);
  for (const id of [...peers.keys()]) {
    if (!known.has(id)) removePeer(id);
  }
  publish();
}

function sendState(local) {
  if (status !== 'online' || !channel || !local) return;
  const now = performance.now();
  if (now - lastSend < SEND_INTERVAL) return;
  lastSend = now;
  sentStates += 1;
  channel.send({
    type: 'broadcast',
    event: 'state',
    payload: {
      i: uid,
      n: callsign,
      x: +local.x.toFixed(2),
      y: +local.y.toFixed(2),
      z: +local.z.toFixed(2),
      h: +local.heading.toFixed(3),
      ty: +local.turretYaw.toFixed(3),
      gp: +local.gunPitch.toFixed(3),
      s: +local.speed.toFixed(1),
      t: Date.now(),
    },
  }).catch((error) => {
    lastNetError = String(error?.message || error);
  });
}

function updatePeers(dt, now) {
  const blend = 1 - Math.exp(-12 * Math.min(dt, 0.05));
  for (const [id, peer] of peers) {
    if (now - peer.lastSeen > PEER_TIMEOUT) {
      removePeer(id);
      publish();
      continue;
    }
    if (!peer.ready || !peer.target) continue;
    const target = peer.target;
    peer.group.position.x += (target.x - peer.group.position.x) * blend;
    peer.group.position.y += (target.y - peer.group.position.y) * blend;
    peer.group.position.z += (target.z - peer.group.position.z) * blend;
    peer.group.rotation.y += wrapAngle(target.heading - peer.group.rotation.y) * blend;
    peer.turret.rotation.y += wrapAngle(target.turretYaw - peer.turret.rotation.y) * blend;
    peer.barrel.rotation.x += (target.gunPitch - peer.barrel.rotation.x) * blend;
  }
}

async function loadSupabaseLibrary() {
  if (globalThis.supabase?.createClient) return globalThis.supabase;
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../../vendor/supabase.js', import.meta.url).href;
      script.async = true;
      script.onload = () => {
        if (globalThis.supabase?.createClient) resolve(globalThis.supabase);
        else reject(new Error('Supabase client did not initialize'));
      };
      script.onerror = () => reject(new Error('Supabase client could not be loaded'));
      document.head.append(script);
    }).catch((error) => {
      libraryPromise = null;
      throw error;
    });
  }
  return libraryPromise;
}

async function connect() {
  try {
    const library = await loadSupabaseLibrary();
    if (disposed) return;
    client = library.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    channel = client.channel(`${CHANNEL_PREFIX}:${roomSlug}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: uid },
      },
    });

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === uid) return;
        presenceNames.delete(key);
        removePeer(key);
        syncPresence();
      })
      .on('broadcast', { event: 'state' }, ({ payload }) => consumeState(payload))
      .on('broadcast', { event: 'hello' }, () => {
        lastSend = 0;
        sendState(lastLocal);
      });

    channel.subscribe(async (state) => {
      if (state === 'SUBSCRIBED') {
        clearTimeout(connectTimer);
        status = 'online';
        publish(true);
        try {
          await channel.track({ uid, name: callsign, since: Date.now() });
        } catch {
          // Presence may be disabled; broadcast state is enough for peers.
        }
        syncPresence();
        lastSend = 0;
        sendState(lastLocal);
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        status = 'offline';
        publish(true);
      }
    });

    connectTimer = setTimeout(() => {
      if (status === 'connecting') {
        status = 'offline';
        publish(true);
      }
    }, 8000);
  } catch {
    status = 'offline';
    publish(true);
  }
}

let scene = null;
let onChange = null;
let client = null;
let channel = null;
let libraryPromise = null;
let status = 'connecting';
let disposed = false;
let presenceCount = 1;
let lastSend = 0;
let lastLocal = null;
let lastPublished = '';
let connectTimer = null;
let sentStates = 0;
let receivedStates = 0;
let lastNetError = null;
const presenceNames = new Map();
const peers = new Map();

export function createRangeNet({ scene: targetScene, onChange: onUpdate } = {}) {
  scene = targetScene;
  onChange = onUpdate;
  publish(true);
  connect();
  const pagehide = () => destroy();
  window.addEventListener('pagehide', pagehide, { once: true });

  return {
    getState: () => ({
      status,
      online: status === 'online',
      room,
      callsign,
      count: Math.max(1, presenceCount, peers.size + 1),
      max: MAX_PLAYERS,
      remotes: peers.size,
      roster: [...new Set([
        ...presenceNames.values(),
        ...[...peers.values()].map((peer) => peer.name),
      ])].slice(0, MAX_PLAYERS - 1),
      sent: sentStates,
      received: receivedStates,
      error: lastNetError,
    }),
    update(dt, local) {
      lastLocal = local;
      sendState(local);
      updatePeers(dt, performance.now());
    },
    destroy,
  };
}

function destroy() {
  if (disposed) return;
  disposed = true;
  clearTimeout(connectTimer);
  for (const id of [...peers.keys()]) removePeer(id);
  try { channel?.unsubscribe(); } catch { /* ignore */ }
  try { if (client && channel) client.removeChannel(channel); } catch { /* ignore */ }
  status = 'offline';
  publish(true);
}
