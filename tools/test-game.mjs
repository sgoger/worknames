// Tests du moteur de jeu (logique pure). Usage : node tools/test-game.mjs
// Vérifie les règles critiques + la validité du deck keys.json.

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

// Layout valide : 9 blue, 8 red, 7 neutral, 1 assassin (start=blue).
//                 0123456789...
const LAYOUT_BLUE = "bbbbbbbbbrrrrrrrrnnnnnnna";
//                   9 b        8 r     7 n   a

console.log("\n[validation des mots]");
{
  const r1 = validateWords(["A", "B"]);
  ok(!r1.ok, "moins de 25 mots → invalide");
  const dup = Array.from({ length: 25 }, (_, i) => "MOT" + i).concat("MOT0");
  const r2 = validateWords(dup);
  ok(!r2.ok, "doublons → invalide");
  const good = validateWords(Array.from({ length: 30 }, (_, i) => "MOT" + i));
  ok(good.ok, "30 mots distincts → valide");
}

console.log("\n[validation des clés]");
{
  ok(validateKey(key("blue", LAYOUT_BLUE)).ok, "clé 9/8/7/1 → valide");
  ok(!validateKey(key("blue", "bbbbbbbbbbrrrrrrrrnnnnnna")).ok, "trop de bleu → invalide");
  ok(!validateKey({ start: "blue", grid: ["blue"] }).ok, "grid trop courte → invalide");
}

console.log("\n[état initial]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  eq(s.activeTeam, "blue", "équipe active = start");
  eq(s.startTeam, "blue", "startTeam");
  eq(s.totals.blue, 9, "total bleu");
  eq(s.totals.red, 8, "total rouge");
  eq(s.counts.blue, 9, "compteur bleu initial");
  eq(s.counts.red, 8, "compteur rouge initial");
  ok(
    s.revealed.every((r) => r === null),
    "aucune carte révélée au départ"
  );
}

console.log("\n[révéler une carte de l'équipe active → le tour continue]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  revealCard(s, 0); // case 0 = blue
  eq(s.revealed[0], "blue", "carte recouverte en bleu");
  eq(s.counts.blue, 8, "compteur bleu décrémenté");
  eq(s.activeTeam, "blue", "toujours au tour des bleus");
  eq(s.revealedThisTurn, 1, "revealedThisTurn = 1");
}

console.log("\n[révéler un témoin → fin de tour]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  // index 17..23 = neutral
  revealCard(s, 17);
  eq(s.revealed[17], "neutral", "carte recouverte témoin");
  eq(s.activeTeam, "red", "le tour passe aux rouges");
  eq(s.revealedThisTurn, 0, "compteur de tour réinitialisé");
}

console.log("\n[révéler une carte adverse → fin de tour + compteur adverse]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  revealCard(s, 9); // index 9 = red
  eq(s.revealed[9], "red", "carte recouverte rouge");
  eq(s.counts.red, 7, "compteur rouge décrémenté");
  eq(s.activeTeam, "red", "fin de tour → rouges");
}

console.log("\n[assassin → défaite immédiate de l'équipe active]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  revealCard(s, 24); // index 24 = assassin
  ok(s.finished, "partie terminée");
  eq(s.winner, "red", "l'équipe active (bleu) perd → rouge gagne");
  eq(s.endCause, "assassin", "cause = assassin");
}

console.log("\n[victoire : une équipe révèle toutes ses cartes]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  for (let i = 0; i < 9; i++) revealCard(s, i); // les 9 cartes bleues
  ok(s.finished, "partie terminée");
  eq(s.winner, "blue", "bleu gagne");
  eq(s.endCause, "cards", "cause = cartes");
}

console.log("\n[victoire pendant le tour adverse : tester la victoire AVANT de changer d'équipe]");
{
  // Rouge actif révèle la dernière carte BLEUE → bleu doit gagner,
  // sans que le tour ne bascule.
  const s = initState(WORDS25, key("red", LAYOUT_BLUE)); // start=red → 9 red? non.
  // Avec start=red sur LAYOUT_BLUE, la grille a 9 blue / 8 red mais start=red
  // attend 9 red : on construit donc une grille adaptée.
  const s2 = initState(WORDS25, key("red", "rrrrrrrrrbbbbbbbbnnnnnnna"));
  // 9 red, 8 blue. Rouge actif. On épuise le bleu manuellement :
  // d'abord on simule : rouge actif clique des cases bleues (adverses) une à une.
  // Chaque clic bleu finit le tour ; on remet rouge actif pour le test.
  // Plus simple : pré-révéler 7 cartes bleues, puis cliquer la 8e en tour rouge.
  for (let i = 9; i < 16; i++) s2.revealed[i] = "blue"; // 7 cartes bleues déjà posées
  s2.counts.blue = 1; // il reste 1 carte bleue
  s2.activeTeam = "red";
  revealCard(s2, 16); // dernière carte bleue, cliquée pendant le tour rouge
  ok(s2.finished, "partie terminée");
  eq(s2.winner, "blue", "bleu gagne même pendant le tour rouge");
  eq(s2.endCause, "cards", "cause = cartes");
  void s; // s non utilisé directement
}

console.log("\n[Terminer le tour : interdit sans révélation, autorisé après ≥ 1]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  ok(!canEndTurn(s), "impossible de passer la main sans avoir révélé");
  ok(endTurn(s) === false, "endTurn refusé");
  eq(s.activeTeam, "blue", "toujours bleu");
  revealCard(s, 0); // 1 carte bleue
  ok(canEndTurn(s), "passe possible après 1 révélation");
  ok(endTurn(s) === true, "endTurn accepté");
  eq(s.activeTeam, "red", "le tour passe aux rouges");
}

console.log("\n[Indice invalide : recouvre une carte adverse + fin de tour]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE)); // bleu actif, adverse = rouge
  const redBefore = s.counts.red;
  invalidClue(s); // case adverse au hasard
  eq(s.counts.red, redBefore - 1, "une carte rouge a été recouverte");
  eq(s.activeTeam, "red", "le tour passe aux rouges");
}

console.log("\n[Indice invalide : peut faire gagner l'adversaire]");
{
  const s = initState(WORDS25, key("blue", LAYOUT_BLUE));
  // Pré-révèle 7 des 8 cartes rouges → il en reste 1.
  let revealedReds = 0;
  for (let i = 0; i < 25 && revealedReds < 7; i++) {
    if (s.grid[i] === "red") {
      s.revealed[i] = "red";
      revealedReds++;
    }
  }
  s.counts.red = 1;
  invalidClue(s); // recouvre la dernière rouge → rouge gagne
  ok(s.finished, "partie terminée");
  eq(s.winner, "red", "rouge gagne via la pénalité");
}

console.log("\n[deck keys.json : 30 clés valides]");
{
  let keys;
  try {
    keys = JSON.parse(readFileSync(new URL("../data/keys.json", import.meta.url), "utf8"));
  } catch (e) {
    ok(false, "keys.json lisible et JSON valide : " + e.message);
    keys = [];
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
  ok(blueStart >= 12 && blueStart <= 18, `répartition équilibrée bleu/rouge (${blueStart}/30 bleu)`);
}

console.log("\n[divers]");
{
  eq(opponent("blue"), "red", "opponent(blue)");
  eq(opponent("red"), "blue", "opponent(red)");
  const g = createGame(
    Array.from({ length: 60 }, (_, i) => "W" + i),
    JSON.parse(readFileSync(new URL("../data/keys.json", import.meta.url), "utf8")),
    { keyMode: "manual", manualKeyNumber: 3 }
  );
  eq(g.keyId, 3, "createGame respecte la clé manuelle");
  eq(new Set(g.words).size, 25, "25 mots distincts échantillonnés");
  void COLORS;
}

console.log(`\n${"-".repeat(48)}`);
console.log(`Résultat : ${passed} réussis, ${failed} échoués`);
process.exit(failed === 0 ? 0 : 1);
