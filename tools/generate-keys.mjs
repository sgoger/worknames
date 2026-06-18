// Génère un deck statique de 30 clés valides pour worknames.
//
// Une clé est un PATRON de couleurs sur les 25 positions de la grille
// (indépendant des mots). Contraintes par clé :
//   - 25 cases, valeurs ∈ {blue, red, neutral, assassin}
//   - exactement 1 assassin, 7 neutral
//   - l'équipe `start` possède 9 cases, l'autre 8
//   - start ∈ {blue, red} (15 clés bleu / 15 clés rouge ici)
//
// Usage : `node tools/generate-keys.mjs` depuis la racine du dépôt.
// La sortie (data/keys.json) est COMMITÉE : le fichier est statique,
// ce script ne sert qu'à le (re)produire si besoin.

import { writeFileSync } from "node:fs";

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeKey(id, start) {
  const other = start === "blue" ? "red" : "blue";
  const cells = [];
  for (let i = 0; i < 9; i++) cells.push(start); // équipe qui commence : 9
  for (let i = 0; i < 8; i++) cells.push(other); // équipe adverse : 8
  for (let i = 0; i < 7; i++) cells.push("neutral"); // 7 témoins
  cells.push("assassin"); // 1 assassin
  shuffle(cells);
  return { id, start, grid: cells };
}

function validateKey(key) {
  const errors = [];
  if (!Array.isArray(key.grid) || key.grid.length !== 25) {
    errors.push("grid doit contenir exactement 25 cases");
    return errors;
  }
  const allowed = new Set(["blue", "red", "neutral", "assassin"]);
  const counts = { blue: 0, red: 0, neutral: 0, assassin: 0 };
  for (const c of key.grid) {
    if (!allowed.has(c)) {
      errors.push(`valeur interdite: ${c}`);
      continue;
    }
    counts[c]++;
  }
  if (counts.assassin !== 1) errors.push(`assassin=${counts.assassin} (attendu 1)`);
  if (counts.neutral !== 7) errors.push(`neutral=${counts.neutral} (attendu 7)`);
  if (!["blue", "red"].includes(key.start)) errors.push(`start invalide: ${key.start}`);
  const other = key.start === "blue" ? "red" : "blue";
  if (counts[key.start] !== 9) errors.push(`${key.start} (start)=${counts[key.start]} (attendu 9)`);
  if (counts[other] !== 8) errors.push(`${other}=${counts[other]} (attendu 8)`);
  return errors;
}

const keys = [];
for (let i = 0; i < 30; i++) {
  // Alterne bleu/rouge → 15 clés bleu, 15 clés rouge.
  const start = i % 2 === 0 ? "blue" : "red";
  keys.push(makeKey(i + 1, start));
}

// Validation stricte avant écriture.
let ok = true;
for (const key of keys) {
  const errors = validateKey(key);
  if (errors.length) {
    ok = false;
    console.error(`Clé n°${key.id} invalide:`, errors.join("; "));
  }
}
if (!ok) {
  console.error("Génération annulée : au moins une clé est invalide.");
  process.exit(1);
}

// Sérialisation lisible : grid en 5 lignes de 5 (diffs propres).
const body = keys
  .map((k) => {
    const rows = [];
    for (let r = 0; r < 5; r++) {
      const slice = k.grid.slice(r * 5, r * 5 + 5).map((c) => JSON.stringify(c));
      rows.push("      " + slice.join(", "));
    }
    return `  {\n    "id": ${k.id},\n    "start": ${JSON.stringify(k.start)},\n    "grid": [\n${rows.join(",\n")}\n    ]\n  }`;
  })
  .join(",\n");

const out = "[\n" + body + "\n]\n";
writeFileSync(new URL("../data/keys.json", import.meta.url), out, "utf8");

const blueStart = keys.filter((k) => k.start === "blue").length;
console.log(`✓ ${keys.length} clés générées (${blueStart} bleu / ${keys.length - blueStart} rouge) → data/keys.json`);
