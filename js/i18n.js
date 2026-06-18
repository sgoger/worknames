// Module i18n centralisé.
// Toutes les chaînes d'UI passent par t(clé[, params]).
// Langue par défaut : fr. La structure `de` est présente (dupliquée du fr)
// avec la mention « à traduire » — point d'entrée unique pour changer la
// langue plus tard via setLanguage('de').

const fr = {
  // Identité
  "app.title": "worknames",
  "app.tagline": "Noms de code — édition équipe",

  // Tour / équipes
  "team.blue": "Bleue",
  "team.red": "Rouge",
  "team.blue.short": "Bleu",
  "team.red.short": "Rouge",
  "turn.active": "Au tour de l'équipe {team}",
  "turn.ended": "Partie terminée",

  // Clé
  "key.label": "Clé n° {n}",
  "key.aria": "Numéro de la clé en cours",

  // Régions (aria)
  "board.aria": "Grille de jeu 5 par 5",
  "clue.section.aria": "Indice",
  "keys.grid.aria": "Clés",

  // Indice (purement informatif)
  "clue.title": "Indice",
  "clue.word.placeholder": "Mot",
  "clue.number.placeholder": "Chiffre",
  "clue.word.aria": "Mot d'indice (optionnel)",
  "clue.number.aria": "Chiffre de l'indice (obligatoire)",
  "clue.validate": "Valider l'indice",

  // Essais restants / attente
  "tries.label": "Essais restants",
  "tries.waiting": "En attente de l'indice",
  "tries.none": "—",

  // Compteurs
  "counts.aria": "Cartes restantes par équipe",
  "counts.remaining": "{n} / {total}",

  // Boutons / actions
  "btn.endTurn": "Terminer le tour",
  "btn.replay": "Rejouer",
  "btn.settings": "Réglages",
  "btn.printKeys": "Imprimer les clés",
  "btn.startTimer": "Lancer le sablier",
  "btn.stopTimer": "Arrêter le sablier",
  "btn.invalidClue": "Indice invalide",
  "btn.close": "Fermer",
  "btn.apply": "Appliquer",

  // Sablier
  "timer.title": "Sablier",
  "timer.done": "Temps écoulé",

  // Réglages
  "settings.title": "Réglages",
  "settings.timerDuration": "Durée du sablier (secondes)",
  "settings.sound": "Son du sablier",
  "settings.keyMode": "Sélection de la clé",
  "settings.keyMode.random": "Aléatoire",
  "settings.keyMode.manual": "Manuelle",
  "settings.manualKey": "Numéro de clé (1 à {max})",
  "settings.saved": "Réglages enregistrés.",

  // Fin de partie
  "end.win": "L'équipe {team} gagne !",
  "end.cause.cards": "Toutes ses cartes ont été trouvées.",
  "end.cause.assassin": "L'assassin a été révélé.",

  // Confirmations
  "confirm.replay": "Une partie est en cours. Lancer une nouvelle partie ?",
  "confirm.invalidClue":
    "Appliquer la pénalité d'indice invalide ? Une carte adverse sera révélée et le tour prendra fin.",

  // Erreurs de données
  "error.title": "Données invalides",
  "error.words.tooFew": "Le fichier words.json contient moins de 25 mots.",
  "error.words.duplicates": "Le fichier words.json contient des doublons.",
  "error.words.load": "Impossible de charger words.json.",
  "error.keys.load": "Impossible de charger keys.json.",
  "error.keys.none": "Aucune clé valide dans keys.json.",
  "error.hint":
    "En local, les JSON doivent être servis via un serveur statique (voir le README). Corrigez data/words.json ou data/keys.json puis rechargez la page.",

  // Page d'impression des clés
  "keys.page.title": "worknames — clés à imprimer",
  "keys.heading": "Clés à imprimer",
  "keys.intro":
    "Imprimez une fois, plastifiez, réutilisez. Les Maîtres-Espions prennent la carte dont le numéro s'affiche à l'écran. La rangée du haut de chaque clé correspond à la rangée du haut de la grille projetée.",
  "keys.warning": "Page réservée aux Maîtres-Espions — ne jamais projeter ni montrer à la salle.",
  "keys.back": "← Retour au jeu",
  "keys.print": "Imprimer",
  "keys.up": "HAUT",
  "keys.start": "Commence : {team}",
  "keys.load.error": "Impossible de charger keys.json. En local, servez le site via un serveur statique (voir le README).",
  "keys.legend.title": "Légende",

  // Divers
  "card.aria.hidden": "Carte non révélée : {word}",
  "card.aria.revealed": "Carte révélée : {word} ({color})",
  "color.blue": "bleu",
  "color.red": "rouge",
  "color.neutral": "témoin",
  "color.assassin": "assassin",
};

// --- Allemand : à traduire ---
// Dupliqué du français pour garantir un fallback complet.
// Remplacer les valeurs ci-dessous par les traductions allemandes.
const de = { ...fr };

export const translations = { fr, de };

let currentLang = "fr";

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    document.documentElement?.setAttribute?.("lang", lang);
  }
  return currentLang;
}

export function getLanguage() {
  return currentLang;
}

export function t(key, params) {
  const table = translations[currentLang] || translations.fr;
  let str = key in table ? table[key] : key in translations.fr ? translations.fr[key] : key;
  if (params) {
    for (const k of Object.keys(params)) {
      str = str.replaceAll("{" + k + "}", String(params[k]));
    }
  }
  return str;
}
