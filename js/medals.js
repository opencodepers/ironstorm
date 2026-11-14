// ------------------------------------------------------------------
//  Medals — 24 long-term achievements. Each one reports progress from
//  the player's career counters and the local battle ledger, so the
//  cabinet fills in for guests and signed-in commanders alike.
// ------------------------------------------------------------------

const pct = (have, need) => ({ have: Math.max(0, Math.min(have, need)), need });

const allUpgradesMaxed = (p) =>
  ['firepower', 'armor', 'engine', 'reload', 'tracks']
    .every((k) => (p?.upgrades?.[k] | 0) >= 5);

export const MEDALS = [
  {
    id: 'first_blood', name: 'FIRST BLOOD', tier: 'BRONZE', salvage: 25,
    desc: 'Destroy your first enemy tank.',
    metric: ({ profile }) => pct(profile?.kills | 0, 1),
  },
  {
    id: 'kills_50', name: 'GUNNER', tier: 'BRONZE', salvage: 40,
    desc: 'Destroy 50 enemy tanks.',
    metric: ({ profile }) => pct(profile?.kills | 0, 50),
  },
  {
    id: 'kills_250', name: 'TANK ACE', tier: 'SILVER', salvage: 90,
    desc: 'Destroy 250 enemy tanks.',
    metric: ({ profile }) => pct(profile?.kills | 0, 250),
  },
  {
    id: 'kills_1000', name: 'IRON LEGEND', tier: 'ELITE', salvage: 220,
    desc: 'Destroy 1,000 enemy tanks.',
    metric: ({ profile }) => pct(profile?.kills | 0, 1000),
  },
  {
    id: 'wins_5', name: 'SQUAD LEADER', tier: 'BRONZE', salvage: 40,
    desc: 'Win 5 battles.',
    metric: ({ profile }) => pct(profile?.wins | 0, 5),
  },
  {
    id: 'wins_25', name: 'FIELD MARSHAL', tier: 'SILVER', salvage: 100,
    desc: 'Win 25 battles.',
    metric: ({ profile }) => pct(profile?.wins | 0, 25),
  },
  {
    id: 'wins_100', name: 'WARLORD', tier: 'ELITE', salvage: 240,
    desc: 'Win 100 battles.',
    metric: ({ profile }) => pct(profile?.wins | 0, 100),
  },
  {
    id: 'matches_10', name: 'IN THE FIGHT', tier: 'BRONZE', salvage: 30,
    desc: 'Complete 10 battles.',
    metric: ({ profile }) => pct(profile?.matches | 0, 10),
  },
  {
    id: 'matches_50', name: 'VETERAN', tier: 'SILVER', salvage: 80,
    desc: 'Complete 50 battles.',
    metric: ({ profile }) => pct(profile?.matches | 0, 50),
  },
  {
    id: 'matches_200', name: 'LIFER', tier: 'ELITE', salvage: 200,
    desc: 'Complete 200 battles.',
    metric: ({ profile }) => pct(profile?.matches | 0, 200),
  },
  {
    id: 'streak_3', name: 'TRIPLE THREAT', tier: 'BRONZE', salvage: 30,
    desc: 'Reach a 3-kill streak.',
    metric: ({ local }) => pct(local?.bestStreak | 0, 3),
  },
  {
    id: 'streak_6', name: 'RAMPAGE', tier: 'SILVER', salvage: 70,
    desc: 'Reach a 6-kill streak.',
    metric: ({ local }) => pct(local?.bestStreak | 0, 6),
  },
  {
    id: 'streak_10', name: 'UNSTOPPABLE', tier: 'ELITE', salvage: 160,
    desc: 'Reach a 10-kill streak.',
    metric: ({ local }) => pct(local?.bestStreak | 0, 10),
  },
  {
    id: 'wave_10', name: 'LAST LINE', tier: 'SILVER', salvage: 120,
    desc: 'Survive to wave 10.',
    metric: ({ local }) => pct(local?.bestWave | 0, 10),
  },
  {
    id: 'ace', name: 'ACE IN A BATTLE', tier: 'SILVER', salvage: 90,
    desc: 'Destroy 8 tanks in a single battle.',
    metric: ({ local }) => pct(local?.bestKills | 0, 8),
  },
  {
    id: 'flawless', name: 'FLAWLESS', tier: 'GOLD', salvage: 150,
    desc: 'Win a battle with 5+ kills and no losses.',
    metric: ({ local }) => pct(local?.flawless | 0, 1),
  },
  {
    id: 'accuracy', name: 'SHARPSHOOTER', tier: 'SILVER', salvage: 100,
    desc: 'Finish a battle with 80% accuracy.',
    metric: ({ local }) => pct(local?.bestAccuracy | 0, 80),
  },
  {
    id: 'all_tanks', name: 'FULL MOTOR POOL', tier: 'GOLD', salvage: 180,
    desc: 'Own all 12 vehicles.',
    metric: ({ profile }) => pct(profile?.owned?.length | 0, 12),
  },
  {
    id: 'all_camos', name: 'PAINT SHOP', tier: 'GOLD', salvage: 160,
    desc: 'Own all 8 camouflage patterns.',
    metric: ({ profile }) => pct(profile?.ownedSkins?.length | 0, 8),
  },
  {
    id: 'maxed', name: 'FULLY KITTED', tier: 'ELITE', salvage: 200,
    desc: 'Max every upgrade line.',
    metric: ({ profile }) => {
      const done = ['firepower', 'armor', 'engine', 'reload', 'tracks']
        .filter((k) => (profile?.upgrades?.[k] | 0) >= 5).length;
      return pct(done, 5);
    },
  },
  {
    id: 'mode_deathmatch', name: 'LONE WOLF', tier: 'BRONZE', salvage: 50,
    desc: 'Win a Deathmatch.',
    metric: ({ local }) => pct(local?.modeWins?.deathmatch | 0, 1),
  },
  {
    id: 'mode_team', name: 'SQUADRON', tier: 'BRONZE', salvage: 50,
    desc: 'Win a Team Battle.',
    metric: ({ local }) => pct(local?.modeWins?.team | 0, 1),
  },
  {
    id: 'mode_koth', name: 'ZONE KEEPER', tier: 'SILVER', salvage: 80,
    desc: 'Win a King of the Hill.',
    metric: ({ local }) => pct(local?.modeWins?.koth | 0, 1),
  },
  {
    id: 'mode_survival', name: 'OVERWHELMING', tier: 'SILVER', salvage: 80,
    desc: 'Win a Survival run.',
    metric: ({ local }) => pct(local?.modeWins?.survival | 0, 1),
  },
];

export const MEDAL_COUNT = MEDALS.length;

export function medalById(id) {
  return MEDALS.find((m) => m.id === id) || null;
}

export function medalProgress(medal, ctx) {
  const { have, need } = medal.metric(ctx) || { have: 0, need: 1 };
  return { have, need, pct: need ? Math.min(1, have / need) : 1, done: have >= need };
}

// Returns every medal that has just been earned and is not in the ledger yet.
export function evaluateMedals(ctx) {
  const earned = [];
  for (const medal of MEDALS) {
    if (ctx.local?.medals?.[medal.id]) continue;
    const p = medalProgress(medal, ctx);
    if (p.done) earned.push(medal);
  }
  return earned;
}

export function unlockedCount(local) {
  return MEDALS.filter((m) => local?.medals?.[m.id]).length;
}

export function allUpgradesDone(profile) {
  return allUpgradesMaxed(profile);
}
