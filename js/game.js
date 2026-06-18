// Moteur de jeu worknames — logique pure, sans DOM ni i18n.
// Testable en Node (voir tools/test-game.mjs).
//
// La clé est POSITIONNELLE : `grid` donne la couleur de chacune des 25
// positions. Les mots sont tirés et placés indépendamment dans ces positions.
// L'app conserve `grid` en mémoire uniquement pour valider les clics — jamais
// affiché (sauf une carte déjà révélée).

export const STATE_VERSION = 1;
export const GRID_SIZE = 25;
export const COLORS = Object.freeze({
  BLUE: "blue",
  RED: "red",
  NEUTRAL: "neutral",
  ASSASSIN: "assassin",
});

export function opponent(team) {
  return team === "blue" ? "red" : "blue";
}

// --- Validation des données ----------------------------------------------

export function validateWords(words) {
  const errors = [];
  if (!Array.isArray(words)) {
    errors.push("words.json doit être un tableau de chaînes.");
    return { ok: false, errors };
  }
  const cleaned = words
    .filter((w) => typeof w === "string")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  if (cleaned.length < GRID_SIZE) {
    errors.push(`Au moins ${GRID_SIZE} mots requis (trouvés : ${cleaned.length}).`);
  }
  const seen = new Set();
  const dups = new Set();
  for (const w of cleaned) {
    const norm = w.toLocaleUpperCase("fr");
    if (seen.has(norm)) dups.add(w);
    seen.add(norm);
  }
  if (dups.size > 0) {
    errors.push(`Doublons détectés : ${[...dups].join(", ")}.`);
  }
  return { ok: errors.length === 0, errors, cleaned };
}

export function validateKey(key) {
  const errors = [];
  if (!key || !Array.isArray(key.grid) || key.grid.length !== GRID_SIZE) {
    errors.push(`grid doit contenir exactement ${GRID_SIZE} cases.`);
    return { ok: false, errors };
  }
  const allowed = new Set([COLORS.BLUE, COLORS.RED, COLORS.NEUTRAL, COLORS.ASSASSIN]);
  const counts = { blue: 0, red: 0, neutral: 0, assassin: 0 };
  for (const c of key.grid) {
    if (!allowed.has(c)) {
      errors.push(`Valeur de case interdite : ${c}.`);
      continue;
    }
    counts[c]++;
  }
  if (counts.assassin !== 1) errors.push(`assassin = ${counts.assassin} (attendu 1).`);
  if (counts.neutral !== 7) errors.push(`neutral = ${counts.neutral} (attendu 7).`);
  if (key.start !== "blue" && key.start !== "red") {
    errors.push(`start invalide : ${key.start}.`);
  } else {
    const other = opponent(key.start);
    if (counts[key.start] !== 9) errors.push(`${key.start} (start) = ${counts[key.start]} (attendu 9).`);
    if (counts[other] !== 8) errors.push(`${other} = ${counts[other]} (attendu 8).`);
  }
  return { ok: errors.length === 0, errors };
}

// --- Tirage ----------------------------------------------------------------

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sampleWords(words, n = GRID_SIZE) {
  return shuffle(words).slice(0, n);
}

// Choisit une clé selon le mode. `manualNumber` = id (1-based) attendu.
export function pickKey(keys, mode = "random", manualNumber = null) {
  if (mode === "manual" && manualNumber != null) {
    const found = keys.find((k) => k.id === Number(manualNumber));
    if (found) return found;
  }
  return keys[Math.floor(Math.random() * keys.length)];
}

// --- Construction d'un état ------------------------------------------------

// Construit l'état initial à partir d'EXACTEMENT 25 mots et d'une clé.
export function initState(words, key) {
  const grid = key.grid.slice();
  const totals = {
    blue: grid.filter((c) => c === COLORS.BLUE).length,
    red: grid.filter((c) => c === COLORS.RED).length,
  };
  return {
    v: STATE_VERSION,
    words: words.slice(0, GRID_SIZE),
    keyId: key.id,
    grid, // patron de la clé (jamais affiché)
    revealed: new Array(GRID_SIZE).fill(null), // null | "blue" | "red" | "neutral" | "assassin"
    startTeam: key.start,
    activeTeam: key.start,
    totals, // totaux de départ (pour affichage 9/8)
    counts: { blue: totals.blue, red: totals.red }, // restants
    revealedThisTurn: 0, // révélations de la couleur active faites ce tour
    // Indice du tour : N (number) est obligatoire et fonctionnel (plafond N+1) ;
    // word est optionnel/décoratif. validated débloque les cartes.
    clue: { word: "", number: null, validated: false },
    finished: false,
    winner: null,
    endCause: null, // "cards" | "assassin"
  };
}

// Crée une partie complète : échantillonne 25 mots + choisit une clé.
export function createGame(words, keys, { keyMode = "random", manualKeyNumber = null } = {}) {
  const picked = sampleWords(words, GRID_SIZE);
  const key = pickKey(keys, keyMode, manualKeyNumber);
  return initState(picked, key);
}

// --- Mécanique de jeu ------------------------------------------------------

function switchTeam(state) {
  state.activeTeam = opponent(state.activeTeam);
  state.revealedThisTurn = 0;
  // Nouveau tour → l'indice doit être re-saisi et validé (cartes bloquées).
  state.clue = { word: "", number: null, validated: false };
}

// Bas niveau : recouvre la carte i, décrémente le compteur concerné,
// puis teste la victoire. NE change PAS d'équipe.
// Ordre impératif : recouvrir → décrémenter → tester la victoire.
function coverAndTest(state, i) {
  const color = state.grid[i];
  state.revealed[i] = color; // 1) recouvrir

  if (color === COLORS.BLUE || color === COLORS.RED) {
    state.counts[color]--; // 2) décrémenter
  }

  // 3) tester la victoire (AVANT tout changement d'équipe)
  if (color === COLORS.ASSASSIN) {
    state.finished = true;
    state.winner = opponent(state.activeTeam); // l'équipe active perd
    state.endCause = "assassin";
    return color;
  }
  if (state.counts.blue === 0) {
    state.finished = true;
    state.winner = "blue";
    state.endCause = "cards";
    return color;
  }
  if (state.counts.red === 0) {
    state.finished = true;
    state.winner = "red";
    state.endCause = "cards";
    return color;
  }
  return color;
}

// Les cartes ne sont cliquables que si l'indice du tour est validé.
export function canRevealCards(state) {
  return !state.finished && state.clue.validated === true;
}

// Essais restants ce tour = N + 1 − révélations déjà faites.
// Renvoie null tant que l'indice n'est pas validé (afficher « en attente »).
export function remainingTries(state) {
  if (!state.clue.validated || !Number.isInteger(state.clue.number)) return null;
  return state.clue.number + 1 - state.revealedThisTurn;
}

// Un Agent clique sur une carte.
export function revealCard(state, i) {
  if (!canRevealCards(state)) return state; // bloqué tant que l'indice n'est pas validé
  if (i < 0 || i >= GRID_SIZE) return state;
  if (state.revealed[i] !== null) return state; // déjà révélée

  const color = coverAndTest(state, i);
  if (state.finished) return state; // victoire/assassin : on s'arrête là

  if (color === state.activeTeam) {
    // couleur de l'équipe active → le tour continue
    state.revealedThisTurn++;
    // Plafond N+1 : après la (N+1)ᵉ révélation, le tour se termine automatiquement.
    if (state.revealedThisTurn >= state.clue.number + 1) {
      switchTeam(state);
    }
  } else {
    // couleur adverse ou témoin → fin de tour immédiate (toute erreur coupe avant)
    switchTeam(state);
  }
  return state;
}

export function canEndTurn(state) {
  // Passe la main volontairement : indice validé + au moins une carte révélée
  // (l'équipe peut donc s'arrêter entre 1 et N+1 révélations).
  return !state.finished && state.clue.validated && state.revealedThisTurn >= 1;
}

// L'équipe active passe la main volontairement (≥ 1 carte révélée requise).
export function endTurn(state) {
  if (!canEndTurn(state)) return false;
  switchTeam(state);
  return true;
}

// Indices des cartes adverses (couleur de l'adversaire) non encore révélées.
export function unrevealedOpponentCards(state) {
  const opp = opponent(state.activeTeam);
  const out = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (state.revealed[i] === null && state.grid[i] === opp) out.push(i);
  }
  return out;
}

// Pénalité d'indice invalide (règle p.7) :
//   (a) recouvre une carte adverse (sa propre couleur),
//   (b) termine le tour de l'équipe active.
// `index` = case adverse choisie par l'opérateur, sinon une au hasard.
export function invalidClue(state, index = null) {
  if (state.finished) return state;
  const opp = opponent(state.activeTeam);
  let target = null;
  if (index != null && state.revealed[index] === null && state.grid[index] === opp) {
    target = index;
  } else {
    const candidates = unrevealedOpponentCards(state);
    if (candidates.length > 0) {
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  if (target != null) {
    coverAndTest(state, target); // recouvre → décrémente → teste la victoire
  }
  if (!state.finished) {
    switchTeam(state); // fin de tour
  }
  return state;
}

// Met à jour l'indice en cours de saisie (sans valider). `number` peut être
// une chaîne (saisie brute) : on tente de la convertir en entier ≥ 1, sinon null.
export function setClue(state, { word, number } = {}) {
  if (word !== undefined) state.clue.word = word ?? "";
  if (number !== undefined) {
    const n = parseInt(number, 10);
    state.clue.number = Number.isInteger(n) && n >= 1 ? n : null;
  }
  return state;
}

// Valide l'indice du tour : fixe N et débloque les cartes.
// Retourne true si N est un entier ≥ 1 (sinon n'a aucun effet).
export function validateClue(state, number) {
  if (state.finished) return false;
  if (number !== undefined) setClue(state, { number });
  if (!Number.isInteger(state.clue.number) || state.clue.number < 1) return false;
  state.clue.validated = true;
  return true;
}
