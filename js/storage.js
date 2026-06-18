// Persistance via localStorage, sous une clé versionnée.
// Stocke { v, game, settings }. Les réglages survivent à « Rejouer ».

import { STATE_VERSION, GRID_SIZE } from "./game.js";

const STORAGE_KEY = "worknames_v1";

export const DEFAULT_SETTINGS = Object.freeze({
  timerDuration: 60, // secondes
  sound: false, // son du sablier (off par défaut)
  keyMode: "random", // "random" | "manual"
  manualKeyNumber: 1,
});

function isValidGame(game) {
  if (!game || typeof game !== "object") return false;
  if (game.v !== STATE_VERSION) return false;
  if (!Array.isArray(game.words) || game.words.length !== GRID_SIZE) return false;
  if (!Array.isArray(game.grid) || game.grid.length !== GRID_SIZE) return false;
  if (!Array.isArray(game.revealed) || game.revealed.length !== GRID_SIZE) return false;
  if (game.startTeam !== "blue" && game.startTeam !== "red") return false;
  if (game.activeTeam !== "blue" && game.activeTeam !== "red") return false;
  if (!game.counts || typeof game.counts.blue !== "number" || typeof game.counts.red !== "number") {
    return false;
  }
  return true;
}

export function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  s.timerDuration = Number.isFinite(s.timerDuration) ? Math.min(Math.max(Math.round(s.timerDuration), 5), 3600) : 60;
  s.sound = Boolean(s.sound);
  s.keyMode = s.keyMode === "manual" ? "manual" : "random";
  const n = Number(s.manualKeyNumber);
  s.manualKeyNumber = Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
  return s;
}

// Retourne { game, settings } ou null. Tolère un stockage corrompu/obsolète.
export function load() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage indisponible
  }
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // JSON corrompu → nouvelle partie
  }
  if (!parsed || parsed.v !== STATE_VERSION) return null;
  const settings = sanitizeSettings(parsed.settings);
  const game = isValidGame(parsed.game) ? parsed.game : null;
  return { game, settings };
}

export function loadSettings() {
  const data = load();
  return data ? data.settings : { ...DEFAULT_SETTINGS };
}

export function save(game, settings) {
  try {
    const payload = JSON.stringify({
      v: STATE_VERSION,
      game,
      settings: sanitizeSettings(settings),
    });
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch {
    return false; // quota/Safari privé… : on n'interrompt pas le jeu
  }
}

// Efface l'état de partie mais CONSERVE les réglages.
export function clearGame(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: STATE_VERSION, game: null, settings: sanitizeSettings(settings) })
    );
  } catch {
    /* ignore */
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
