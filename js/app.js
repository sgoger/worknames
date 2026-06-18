// worknames — bootstrap, rendu et événements de la vue projetée.

import { t, setLanguage } from "./i18n.js";
import * as game from "./game.js";
import * as storage from "./storage.js";

const { COLORS, GRID_SIZE } = game;

// État applicatif en mémoire.
let state = null; // état de partie (game.js)
let settings = { ...storage.DEFAULT_SETTINGS };
let words = [];
let keys = [];

// --- Raccourcis DOM --------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  app: $("app"),
  appTitle: $("appTitle"),
  appTagline: $("appTagline"),
  turnText: $("turnText"),
  keyLabel: $("keyLabel"),
  keyBadge: $("keyBadge"),
  clueBar: $("clueBar"),
  clueTag: $("clueTag"),
  clueWord: $("clueWord"),
  clueNumber: $("clueNumber"),
  board: $("board"),
  scoreBlueLabel: $("scoreBlueLabel"),
  scoreBlueValue: $("scoreBlueValue"),
  scoreRedLabel: $("scoreRedLabel"),
  scoreRedValue: $("scoreRedValue"),
  timer: $("timer"),
  timerValue: $("timerValue"),
  endTurnBtn: $("endTurnBtn"),
  timerBtn: $("timerBtn"),
  invalidClueBtn: $("invalidClueBtn"),
  settingsBtn: $("settingsBtn"),
  replayBtn: $("replayBtn"),
  printKeysLink: $("printKeysLink"),
  endBanner: $("endBanner"),
  endTitle: $("endTitle"),
  endCause: $("endCause"),
  endReplayBtn: $("endReplayBtn"),
  errorBanner: $("errorBanner"),
  errorTitle: $("errorTitle"),
  errorMessage: $("errorMessage"),
  errorHint: $("errorHint"),
  // Réglages
  settingsDialog: $("settingsDialog"),
  settingsForm: $("settingsForm"),
  settingsTitle: $("settingsTitle"),
  settingTimer: $("settingTimer"),
  settingTimerLabel: $("settingTimerLabel"),
  settingSound: $("settingSound"),
  settingSoundLabel: $("settingSoundLabel"),
  settingKeyModeLabel: $("settingKeyModeLabel"),
  keyModeRandom: $("keyModeRandom"),
  keyModeRandomLabel: $("keyModeRandomLabel"),
  keyModeManual: $("keyModeManual"),
  keyModeManualLabel: $("keyModeManualLabel"),
  settingManualKey: $("settingManualKey"),
  settingManualKeyLabel: $("settingManualKeyLabel"),
  settingsApply: $("settingsApply"),
  settingsClose: $("settingsClose"),
};

const cardEls = []; // 25 boutons

// --- Démarrage -------------------------------------------------------------
init();

async function init() {
  setLanguage("fr");
  applyStaticLabels();

  try {
    [words, keys] = await Promise.all([fetchJSON("./data/words.json"), fetchJSON("./data/keys.json")]);
  } catch (err) {
    console.error(err);
    return showError(t("error.title"), t("error.words.load") + " / " + t("error.keys.load"));
  }

  // Validation des mots.
  const wv = game.validateWords(words);
  if (!wv.ok) {
    console.warn("[worknames] words.json invalide :", wv.errors.join(" "));
    const tooFew = wv.errors.some((e) => e.includes("mots requis"));
    return showError(t("error.title"), tooFew ? t("error.words.tooFew") : t("error.words.duplicates"));
  }
  words = wv.cleaned;

  // Validation des clés (filtre les invalides + console.warn).
  const validKeys = [];
  for (const k of keys) {
    const kv = game.validateKey(k);
    if (kv.ok) validKeys.push(k);
    else console.warn(`[worknames] Clé n°${k?.id} invalide :`, kv.errors.join(" "));
  }
  keys = validKeys;
  if (keys.length === 0) {
    return showError(t("error.title"), t("error.keys.none"));
  }

  buildBoard();
  wireEvents();

  // Restauration ou nouvelle partie.
  const saved = storage.load();
  if (saved) {
    settings = saved.settings;
    state = saved.game && isRestorable(saved.game) ? saved.game : freshGame();
  } else {
    settings = { ...storage.DEFAULT_SETTINGS };
    state = freshGame();
  }
  persist();

  el.app.hidden = false;
  render();
}

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch ${path} → ${res.status}`);
  return res.json();
}

// Vérifie qu'une partie sauvegardée référence une clé encore présente.
function isRestorable(g) {
  return keys.some((k) => k.id === g.keyId);
}

function freshGame() {
  return game.createGame(words, keys, {
    keyMode: settings.keyMode,
    manualKeyNumber: settings.manualKeyNumber,
  });
}

function persist() {
  storage.save(state, settings);
}

// --- Libellés statiques ----------------------------------------------------
function applyStaticLabels() {
  el.appTitle.textContent = t("app.title");
  el.appTagline.textContent = t("app.tagline");
  el.board.setAttribute("aria-label", t("board.aria"));
  el.clueBar.setAttribute("aria-label", t("clue.section.aria"));
  el.clueTag.textContent = t("clue.title");
  el.clueWord.placeholder = t("clue.word.placeholder");
  el.clueNumber.placeholder = t("clue.number.placeholder");
  el.clueWord.setAttribute("aria-label", t("clue.word.aria"));
  el.clueNumber.setAttribute("aria-label", t("clue.number.aria"));
  el.scoreBlueLabel.textContent = t("team.blue.short");
  el.scoreRedLabel.textContent = t("team.red.short");
  el.endTurnBtn.textContent = t("btn.endTurn");
  el.invalidClueBtn.textContent = t("btn.invalidClue");
  el.settingsBtn.textContent = t("btn.settings");
  el.replayBtn.textContent = t("btn.replay");
  el.printKeysLink.textContent = t("btn.printKeys");
  el.endReplayBtn.textContent = t("btn.replay");
  document.title = t("app.title");

  // Réglages
  el.settingsTitle.textContent = t("settings.title");
  el.settingTimerLabel.textContent = t("settings.timerDuration");
  el.settingSoundLabel.textContent = t("settings.sound");
  el.settingKeyModeLabel.textContent = t("settings.keyMode");
  el.keyModeRandomLabel.textContent = t("settings.keyMode.random");
  el.keyModeManualLabel.textContent = t("settings.keyMode.manual");
  el.settingsApply.textContent = t("btn.apply");
  el.settingsClose.textContent = t("btn.close");
}

// --- Construction de la grille --------------------------------------------
function buildBoard() {
  el.board.innerHTML = "";
  cardEls.length = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.dataset.index = String(i);
    btn.setAttribute("role", "gridcell");
    btn.addEventListener("click", () => onCardClick(i));
    el.board.appendChild(btn);
    cardEls.push(btn);
  }
}

// --- Rendu -----------------------------------------------------------------
function render() {
  renderBoard();
  renderStatus();
  renderClue();
  renderEnd();
}

function renderBoard() {
  for (let i = 0; i < GRID_SIZE; i++) {
    const btn = cardEls[i];
    const word = state.words[i];
    const revealedColor = state.revealed[i]; // null | couleur
    btn.textContent = word;
    btn.className = "card";
    if (revealedColor) {
      btn.classList.add("revealed", "color-" + revealedColor);
      btn.disabled = true;
      btn.setAttribute(
        "aria-label",
        t("card.aria.revealed", { word, color: t("color." + revealedColor) })
      );
    } else {
      btn.disabled = state.finished;
      btn.setAttribute("aria-label", t("card.aria.hidden", { word }));
    }
  }
}

function renderStatus() {
  document.body.dataset.active = state.activeTeam;
  document.body.dataset.finished = String(state.finished);

  const teamName = t(state.activeTeam === "blue" ? "team.blue" : "team.red");
  el.turnText.textContent = state.finished ? t("turn.ended") : t("turn.active", { team: teamName });

  el.keyLabel.textContent = t("key.label", { n: state.keyId });
  el.keyBadge.title = t("key.aria");

  el.scoreBlueValue.textContent = t("counts.remaining", {
    n: state.counts.blue,
    total: state.totals.blue,
  });
  el.scoreRedValue.textContent = t("counts.remaining", {
    n: state.counts.red,
    total: state.totals.red,
  });

  el.endTurnBtn.disabled = !game.canEndTurn(state);
  el.invalidClueBtn.disabled = state.finished;
  el.timerBtn.disabled = state.finished && timerId === null ? true : false;
}

function renderClue() {
  if (document.activeElement !== el.clueWord) el.clueWord.value = state.clue.word || "";
  if (document.activeElement !== el.clueNumber) el.clueNumber.value = state.clue.number || "";
}

function renderEnd() {
  if (state.finished && state.winner) {
    const teamName = t(state.winner === "blue" ? "team.blue" : "team.red");
    el.endTitle.textContent = t("end.win", { team: teamName });
    el.endCause.textContent = t(
      state.endCause === "assassin" ? "end.cause.assassin" : "end.cause.cards"
    );
    el.endBanner.dataset.winner = state.winner;
    el.endBanner.hidden = false;
  } else {
    el.endBanner.hidden = true;
    delete el.endBanner.dataset.winner;
  }
}

// --- Actions de jeu --------------------------------------------------------
function onCardClick(i) {
  if (state.finished || state.revealed[i] !== null) return;
  game.revealCard(state, i);
  stopTimerIfTurnChanged();
  persist();
  render();
}

function onEndTurn() {
  if (!game.canEndTurn(state)) return;
  game.endTurn(state);
  stopTimer();
  persist();
  render();
}

function onInvalidClue() {
  if (state.finished) return;
  if (!confirm(t("confirm.invalidClue"))) return;
  game.invalidClue(state); // case adverse au hasard
  stopTimer();
  persist();
  render();
}

function onReplay() {
  const inProgress = !state.finished && state.revealed.some((r) => r !== null);
  if (inProgress && !confirm(t("confirm.replay"))) return;
  stopTimer();
  storage.clearGame(settings);
  state = freshGame();
  persist();
  render();
}

function onClueInput() {
  game.setClue(state, el.clueWord.value, el.clueNumber.value);
  persist();
}

// --- Sablier ---------------------------------------------------------------
let timerId = null;
let timerRemaining = 0;

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function startTimer() {
  stopTimer();
  timerRemaining = settings.timerDuration;
  el.timer.hidden = false;
  el.timer.classList.remove("done");
  updateTimerView();
  el.timerBtn.textContent = t("btn.stopTimer");
  timerId = setInterval(() => {
    timerRemaining--;
    updateTimerView();
    if (timerRemaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      el.timer.classList.add("done", "warning");
      el.timerBtn.textContent = t("btn.startTimer");
      if (settings.sound) beep();
    }
  }, 1000);
}

function updateTimerView() {
  el.timerValue.textContent = formatTime(Math.max(0, timerRemaining));
  el.timer.classList.toggle("warning", timerRemaining <= 10 && timerRemaining > 0);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  el.timer.hidden = true;
  el.timer.classList.remove("done", "warning");
  el.timerBtn.textContent = t("btn.startTimer");
}

// À chaque clic, si le tour a basculé/fini, on arrête le sablier du tour.
let lastActive = null;
function stopTimerIfTurnChanged() {
  if (lastActive !== null && (lastActive !== state.activeTeam || state.finished)) {
    stopTimer();
  }
  lastActive = state.activeTeam;
}

function onTimerBtn() {
  if (timerId !== null) stopTimer();
  else startTimer();
}

// Bip généré via WebAudio (aucune dépendance/fichier externe).
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => ctx.close();
  } catch {
    /* audio indisponible : on ignore */
  }
}

// --- Réglages --------------------------------------------------------------
function openSettings() {
  el.settingTimer.value = settings.timerDuration;
  el.settingSound.checked = settings.sound;
  el.keyModeRandom.checked = settings.keyMode === "random";
  el.keyModeManual.checked = settings.keyMode === "manual";
  el.settingManualKey.max = String(keys.length);
  el.settingManualKey.value = Math.min(settings.manualKeyNumber, keys.length);
  el.settingManualKeyLabel.textContent = t("settings.manualKey", { max: keys.length });
  syncKeyModeUI();
  el.settingsDialog.showModal();
}

function syncKeyModeUI() {
  el.settingsDialog.dataset.keymode = el.keyModeManual.checked ? "manual" : "random";
}

function onSettingsSubmit(e) {
  e.preventDefault();
  settings = storage.sanitizeSettings({
    timerDuration: Number(el.settingTimer.value),
    sound: el.settingSound.checked,
    keyMode: el.keyModeManual.checked ? "manual" : "random",
    manualKeyNumber: Number(el.settingManualKey.value),
  });
  persist();
  el.settingsDialog.close();
}

// --- Câblage des événements ------------------------------------------------
function wireEvents() {
  el.endTurnBtn.addEventListener("click", onEndTurn);
  el.invalidClueBtn.addEventListener("click", onInvalidClue);
  el.replayBtn.addEventListener("click", onReplay);
  el.endReplayBtn.addEventListener("click", onReplay);
  el.timerBtn.addEventListener("click", onTimerBtn);
  el.settingsBtn.addEventListener("click", openSettings);
  el.settingsClose.addEventListener("click", () => el.settingsDialog.close());
  el.settingsForm.addEventListener("submit", onSettingsSubmit);
  el.keyModeRandom.addEventListener("change", syncKeyModeUI);
  el.keyModeManual.addEventListener("change", syncKeyModeUI);
  el.clueWord.addEventListener("input", onClueInput);
  el.clueNumber.addEventListener("input", onClueInput);

  // libellé initial du bouton sablier
  el.timerBtn.textContent = t("btn.startTimer");
  lastActive = null;
}

// --- Erreurs de données ----------------------------------------------------
function showError(title, message) {
  el.app.hidden = true;
  el.errorTitle.textContent = title;
  el.errorMessage.textContent = message;
  el.errorHint.textContent = t("error.hint");
  el.errorBanner.hidden = false;
}
