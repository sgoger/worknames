// Tests du moteur de jeu (logique pure). Usage : node tools/test-game.mjs
// Vérifie les règles critiques (dont le plafond N+1) + la validité du deck.

import { readFileSync } from "node:fs";
import {
  COLORS,
  opponent,
  validateWords,
  validateKey,
  initState,
  createGame,
  revealCard,
  endTurn,
  canEndTurn,
  canRevealCards,
  remainingTries,
  validateClue,
  invalidClue,
} from "../js/game.js";

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function eq(a, b, label) {
  ok(a === b, `${label} (attendu ${b}, obtenu ${a})`);
}

// Construit une clé déterministe à partir d'une chaîne de 25 lettres :
// b=blue, r=red, n=neutral, a=assassin.
function key(start, layout) {
  const map = { b: "blue", r: "red", n: "neutral", a: "assassin" };
  return { id: 99, start, grid: layout.split("").map((c) => map[c]) };
}

const WORDS25 = Array.from({ length: 25 }, (_, i) => "MOT" + i);

// Layout valide : 9 blue (0-8), 8 red (9-16), 7 neutral (17-23), 1 assassin (24).
const LAYOUT_BLUE = "bbbbbbbbbrrrrrrrrnnnnnnna";

// Raccourci : nouvel état bleu-départ avec indice déjà validé (N donné).
function blueGameValidated(n) {
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  validateClue(s, n);
  return s;
}

console.log("\n[validation des mots]");
{
  ok(!validateWords(["A", "B"]).ok, "moins de 25 mots → invalide");
  const dup = Array.from({ length: 25 }, (_, i) => "MOT" + i).concat("MOT0");
  ok(!validateWords(dup).ok, "doublons → invalide");
  ok(validateWords(Array.from({ length: 30 }, (_, i) => "MOT" + i)).ok, "30 mots distincts → valide");
}

console.log("\n[validation des clés]");
{
  ok(validateKey(key("blue", LAYOUT_BLUE)).ok, "clé 9/8/7/1 → valide");
  ok(!validateKey(key("blue", "bbbbbbbbbbrrrrrrrrnnnnnna")).ok, "trop de bleu → invalide");
  ok(!validateKey({ start: "blue", grid: ["blue"] }).ok, "grid trop courte → invalide");
}

console.log("\n[état initial : indice non validé, cartes bloquées]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  eq(s.activeTeam, "blue", "équipe active = start");
  eq(s.clue.validated, false, "indice non validé au départ");
  eq(canRevealCards(s), false, "cartes bloquées tant que l'indice n'est pas validé");
  eq(remainingTries(s), null, "essais restants = null (en attente)");
  eq(s.totals.blue, 9, "total bleu");
  eq(s.totals.red, 8, "total rouge");
}

console.log("\n[blocage : un clic sans indice validé est sans effet]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  revealCard(s, 0);
  eq(s.revealed[0], null, "la carte reste cachée");
  eq(s.counts.blue, 9, "aucun compteur modifié");
}

console.log("\n[validation de l'indice : N entier ≥ 1 obligatoire]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  eq(validateClue(s, 0), false, "N = 0 refusé");
  eq(validateClue(s, "abc"), false, "N non numérique refusé");
  eq(s.clue.validated, false, "toujours non validé après refus");
  eq(validateClue(s, 3), true, "N = 3 accepté");
  eq(s.clue.validated, true, "indice validé");
  eq(canRevealCards(s), true, "cartes débloquées");
  eq(remainingTries(s), 4, "essais restants = N + 1 = 4");
}

console.log("\n[carte de l'équipe active → le tour continue, un essai consommé]");
{
  const s = blueGameValidated(5);
  revealCard(s, 0); // blue
  eq(s.revealed[0], "blue", "carte recouverte en bleu");
  eq(s.counts.blue, 8, "compteur bleu décrémenté");
  eq(s.activeTeam, "blue", "toujours au tour des bleus");
  eq(s.revealedThisTurn, 1, "1 révélation ce tour");
  eq(remainingTries(s), 5, "essais restants = 6 − 1 = 5");
}

console.log("\n[témoin → fin de tour + ré-attente de l'indice]");
{
  const s = blueGameValidated(5);
  revealCard(s, 17); // neutral
  eq(s.revealed[17], "neutral", "carte recouverte témoin");
  eq(s.activeTeam, "red", "le tour passe aux rouges");
  eq(s.clue.validated, false, "le nouvel indice doit être re-validé");
  eq(canRevealCards(s), false, "cartes bloquées pour les rouges en attente");
}

console.log("\n[carte adverse → fin de tour + compteur adverse]");
{
  const s = blueGameValidated(5);
  revealCard(s, 9); // red
  eq(s.revealed[9], "red", "carte recouverte rouge");
  eq(s.counts.red, 7, "compteur rouge décrémenté");
  eq(s.activeTeam, "red", "fin de tour → rouges");
}

console.log("\n[assassin → défaite immédiate de l'équipe active]");
{
  const s = blueGameValidated(5);
  revealCard(s, 24); // assassin
  ok(s.finished, "partie terminée");
  eq(s.winner, "red", "bleu perd → rouge gagne");
  eq(s.endCause, "assassin", "cause = assassin");
}

console.log("\n[plafond N+1 : coupe automatique après la (N+1)ᵉ carte]");
{
  const s = blueGameValidated(2); // N=2 → 3 révélations max
  revealCard(s, 0); // blue
  revealCard(s, 1); // blue
  eq(s.activeTeam, "blue", "encore bleu après 2 cartes");
  eq(remainingTries(s), 1, "1 essai restant avant la carte bonus");
  revealCard(s, 2); // blue → (N+1)ᵉ
  eq(s.activeTeam, "red", "tour coupé automatiquement après la 3ᵉ carte");
  eq(s.counts.blue, 6, "3 cartes bleues révélées (9 → 6)");
  eq(s.clue.validated, false, "indice ré-armé pour les rouges");
}

console.log("\n[erreur avant le plafond : toute erreur coupe le tour]");
{
  const s = blueGameValidated(3); // 4 révélations max
  revealCard(s, 0); // blue
  revealCard(s, 17); // témoin → coupe immédiate, peu importe les essais restants
  eq(s.activeTeam, "red", "le tour est coupé par l'erreur");
}

console.log("\n[Terminer le tour : entre 1 et N+1]");
{
  const s = blueGameValidated(3);
  ok(!canEndTurn(s), "impossible de passer la main sans révélation");
  ok(endTurn(s) === false, "endTurn refusé à 0 révélation");
  revealCard(s, 0); // 1 carte
  ok(canEndTurn(s), "passe possible après 1 carte (< N+1)");
  ok(endTurn(s) === true, "endTurn accepté");
  eq(s.activeTeam, "red", "le tour passe aux rouges");
  eq(s.clue.validated, false, "indice ré-armé");
}

console.log("\n[Terminer le tour interdit tant que l'indice n'est pas validé]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  ok(!canEndTurn(s), "pas de passe sans indice validé");
}

console.log("\n[victoire : une équipe révèle toutes ses cartes]");
{
  const s = blueGameValidated(8); // 9 révélations max = exactement les 9 bleues
  for (let i = 0; i < 9; i++) revealCard(s, i);
  ok(s.finished, "partie terminée");
  eq(s.winner, "blue", "bleu gagne");
  eq(s.endCause, "cards", "cause = cartes");
}

console.log("\n[victoire pendant le tour adverse : tester la victoire AVANT de basculer]");
{
  const s = initState(WORDS25, key("red", "rrrrrrrrrbbbbbbbbnnnnnnna")); // 9 red, 8 blue, red start
  for (let i = 9; i < 16; i++) s.revealed[i] = "blue"; // 7 cartes bleues déjà posées
  s.counts.blue = 1; // il reste 1 carte bleue
  s.activeTeam = "red";
  validateClue(s, 5); // rouge a validé son indice
  revealCard(s, 16); // dernière carte bleue, cliquée pendant le tour rouge
  ok(s.finished, "partie terminée");
  eq(s.winner, "blue", "bleu gagne même pendant le tour rouge");
  eq(s.endCause, "cards", "cause = cartes");
}

console.log("\n[Indice invalide : recouvre une carte adverse + fin de tour]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE)); // bleu actif, adverse = rouge
  const redBefore = s.counts.red;
  invalidClue(s); // applicable même sans indice validé
  eq(s.counts.red, redBefore - 1, "une carte rouge a été recouverte");
  eq(s.activeTeam, "red", "le tour passe aux rouges");
}

console.log("\n[Indice invalide : peut faire gagner l'adversaire]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  let reds = 0;
  for (let i = 0; i < 25 && reds < 7; i++) {
    if (s.grid[i] === "red") {
      s.revealed[i] = "red";
      reds++;
    }
  }
  s.counts.red = 1;
  invalidClue(s); // recouvre la dernière rouge → rouge gagne
  ok(s.finished, "partie terminée");
  eq(s.winner, "red", "rouge gagne via la pénalité");
}

console.log("\n[deck keys.json : 30 clés valides]");
{
  let keys = [];
  try {
    keys = JSON.parse(readFileSync(new URL("../data/keys.json", import.meta.url), "utf8"));
  } catch (e) {
    ok(false, "keys.json lisible : " + e.message);
  }
  eq(keys.length, 30, "30 clés");
  let allValid = true;
  let blueStart = 0;
  const ids = new Set();
  for (const k of keys) {
    const r = validateKey(k);
    if (!r.ok) {
      allValid = false;
      console.error(`    clé ${k.id} :`, r.errors.join("; "));
    }
    if (k.start === "blue") blueStart++;
    ids.add(k.id);
  }
  ok(allValid, "toutes les clés respectent les contraintes (9/8/7/1)");
  eq(ids.size, 30, "ids uniques");
  ok(blueStart >= 12 && blueStart <= 18, `répartition équilibrée (${blueStart}/30 bleu)`);
}

console.log("\n[divers]");
{
  eq(opponent("blue"), "red", "opponent(blue)");
  const keys = JSON.parse(readFileSync(new URL("../data/keys.json", import.meta.url), "utf8"));
  const g = createGame(
    Array.from({ length: 60 }, (_, i) => "W" + i),
    keys,
    { keyMode: "manual", manualKeyNumber: 3 }
  );
  eq(g.keyId, 3, "createGame respecte la clé manuelle");
  eq(new Set(g.words).size, 25, "25 mots distincts échantillonnés");
  eq(g.clue.validated, false, "nouvelle partie : indice non validé");
  void COLORS;
}

console.log(`\n${"-".repeat(48)}`);
console.log(`Résultat : ${passed} réussis, ${failed} échoués`);
process.exit(failed === 0 ? 0 : 1);
