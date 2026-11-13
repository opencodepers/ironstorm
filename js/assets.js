// Sprite loading. Keys are file basenames (without .png).

const FILES = {
  tanks: [
    'tankBody_green', 'tankBody_dark', 'tankBody_sand', 'tankBody_red', 'tankBody_blue',
    'tankBody_bigRed', 'tankBody_huge', 'tankBody_darkLarge',
    'tankGreen_barrel1', 'tankGreen_barrel2', 'tankGreen_barrel3',
    'tankDark_barrel1', 'tankDark_barrel2', 'tankDark_barrel3',
    'tankSand_barrel1', 'tankSand_barrel2', 'tankSand_barrel3',
    'tankRed_barrel1', 'tankRed_barrel2', 'tankRed_barrel3',
    'tankBlue_barrel1', 'tankBlue_barrel2', 'tankBlue_barrel3',
  ],
  terrain: ['tileGrass1', 'tileGrass2', 'tileSand1', 'tileSand2'],
  props: [
    'crateMetal', 'crateWood', 'sandbagBeige', 'sandbagBrown', 'barricadeMetal',
    'barricadeWood', 'barrelRed_top', 'barrelGreen_top', 'barrelBlack_top',
    'fenceRed', 'fenceYellow', 'treeGreen_large', 'treeGreen_small',
    'oilSpill_large', 'tracksSmall', 'tracksDouble',
  ],
  fx: [
    'explosion1', 'explosion2', 'explosion3', 'explosion4', 'explosion5',
    'explosionSmoke1', 'explosionSmoke2', 'explosionSmoke3', 'explosionSmoke4', 'explosionSmoke5',
    'shotLarge', 'shotOrange', 'shotRed', 'shotThin',
    'bulletGreen1', 'bulletGreen2', 'bulletGreen3',
    'bulletRed1', 'bulletRed2', 'bulletRed3',
  ],
};

const images = {};
export const assetState = { loaded: 0, total: 0, ready: false };

function loadOne(key, path) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => { images[key] = im; resolve(true); };
    im.onerror = () => { console.warn('[assets] missing', path); resolve(false); };
    im.src = path;
    images[key] = im;
  });
}

export async function loadAll(onProgress) {
  const jobs = [];
  for (const [dir, keys] of Object.entries(FILES)) {
    for (const k of keys) jobs.push([k, `assets/${dir}/${k}.png`]);
  }
  assetState.total = jobs.length;
  await Promise.all(
    jobs.map(([key, path]) =>
      loadOne(key, path).then(() => {
        assetState.loaded++;
        onProgress?.(assetState.loaded / assetState.total);
      })
    )
  );
  assetState.ready = true;
}

export const img = (key) => images[key];
