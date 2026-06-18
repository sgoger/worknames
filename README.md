# worknames

Un site **100 % statique** qui reproduit les règles de **Codenames** (Vlaada Chvátil / IELLO), avec des cartes « Nom de Code » personnalisées pour une équipe.

Pensé pour un **team-building** : l'écran principal est **projeté à toute la salle**, et les deux Maîtres-Espions utilisent des **cartes Clé imprimées sur papier** (générées par le site). L'application gère le reste : tirage des mots, validation des clics, score, fin de partie, persistance.

- Aucune étape de build, aucun framework, aucune dépendance réseau externe.
- HTML + CSS + JavaScript vanilla (modules ES).
- Fonctionne hors-ligne une fois la page chargée.

---

## 1. Mettre les vrais mots de l'équipe

Éditez [`data/words.json`](data/words.json) : c'est un simple tableau de chaînes.

```json
["RÉUNION", "CAFÉ", "DEADLINE", "MIGRATION", "BACKLOG", "..."]
```

Règles :

- **Au moins 25 mots** (sinon une partie ne peut pas se composer). Idéalement **≥ 60** pour enchaîner plusieurs parties sans répétition.
- **Pas de doublon** (la comparaison ignore la casse).
- Les mots ne sont **pas traduits** : ce sont les termes propres à votre équipe.

Si le fichier est invalide (moins de 25 mots ou doublons), l'application affiche un message d'erreur clair à l'écran et un `console.warn` détaille le problème. À chaque partie, **25 mots distincts** sont tirés au hasard et placés dans la grille.

> Les mots et les clés sont **indépendants** : une clé est un patron de couleurs sur les 25 **positions**, pas sur les mots. C'est pourquoi un deck de clés imprimé une fois reste valable quels que soient les mots tirés.

---

## 2. Imprimer les clés

1. Ouvrez [`keys.html`](keys.html) dans le navigateur.
2. Lancez l'impression : **Ctrl/Cmd + P** (ou le bouton **Imprimer**).
3. Le rendu imprime les **30 clés** sous forme de grilles 5×5 colorées, numérotées, avec un repère **« HAUT »** indiquant le sens de lecture.

Principe : **on imprime une fois, on plastifie, on réutilise.** En partie, l'écran affiche un **numéro de clé** (ex. « Clé n° 12 ») ; les Maîtres-Espions prennent la carte papier correspondante. La rangée du haut de la carte papier correspond à la rangée du haut de la grille projetée.

> ⚠️ **Ne jamais projeter `keys.html`** : cette page révèle toutes les couleurs. Elle est réservée aux Maîtres-Espions.

---

## 3. Héberger sur GitHub Pages

Le dépôt est prévu pour un **project site** à l'adresse `https://sgoger.github.io/worknames/` (servi sous le sous-chemin `/worknames/`). Tous les chemins du site sont **relatifs** (`./data/words.json`, `./js/app.js`…), ce qui le rend compatible avec ce sous-chemin.

1. Poussez le contenu sur le dépôt `https://github.com/sgoger/worknames` (remote `origin`).
2. Sur GitHub : **Settings → Pages**.
3. Choisissez la **branche de déploiement** (ex. `main`) et le dossier racine `/`.
4. Le site sera servi sur **`https://sgoger.github.io/worknames/`**.

Aucune action de build n'est nécessaire : `git push` puis activation de Pages suffisent.

---

## 4. Développement local

Travaillez dans `/Users/simongoger/worknames`.

⚠️ Le chargement des JSON se fait via `fetch`, qui **échoue en `file://`**. Lancez donc un **serveur statique** :

```bash
cd /Users/simongoger/worknames
python3 -m http.server 8000
# puis ouvrez http://localhost:8000/
```

(N'importe quel serveur statique convient : `npx serve`, l'extension Live Server de VS Code, etc.)

### Régénérer le deck de clés (optionnel)

`data/keys.json` est **statique et versionné**. Pour le régénérer :

```bash
node tools/generate-keys.mjs
```

### Lancer les tests du moteur de jeu

```bash
node tools/test-game.mjs
```

---

## 5. Rappels

- ⚠️ **Ne jamais projeter `keys.html`.**
- L'écran projeté n'affiche **jamais** les couleurs de la clé — seulement les cartes déjà révélées et le **numéro** de la clé.
- Le champ « indice » à l'écran est **purement informatif** : l'indice est donné oralement par le Maître-Espion et n'influence pas la logique.

---

## Règles implémentées (mode standard)

- Grille 5×5 = 25 cartes. La clé tirée fixe la répartition : **équipe qui commence : 9**, autre équipe : 8, **7 témoins**, **1 assassin**.
- Une équipe active révèle des cartes :
  - **Sa couleur** → la carte est recouverte, son compteur décrémente, le tour continue.
  - **Couleur adverse** ou **témoin** → carte recouverte, fin du tour.
  - **Assassin** → l'équipe active **perd** immédiatement.
- Ordre d'évaluation après chaque clic : **recouvrir → décrémenter → tester la victoire → (sinon) changer d'équipe**. Toucher la dernière carte adverse fait donc gagner l'adversaire, même pendant votre tour.
- **Aucun plafond de coups** : on révèle autant de cartes que voulu jusqu'à une erreur ou « Terminer le tour ». Le chiffre de l'indice n'est jamais utilisé comme contrainte.
- **Terminer le tour** : passe la main (autorisé après au moins une carte révélée).
- **Fin de partie** : une équipe a révélé toutes ses cartes → elle gagne ; ou l'assassin est révélé → l'équipe active perd.
- **Indice invalide** (optionnel) : termine le tour et recouvre une carte adverse, avec mise à jour du compteur et test de victoire.

Le sablier (durée configurable, son off par défaut) est une aide visuelle : il n'a **aucun effet mécanique** sur le jeu.

## Structure du projet

```
/
├── index.html              # Vue projetée + contrôles
├── keys.html               # Page d'impression des clés
├── css/
│   └── style.css
├── js/
│   ├── app.js              # Bootstrap, rendu, événements UI
│   ├── game.js             # Logique de jeu (pure, testable)
│   ├── storage.js          # Persistance localStorage
│   └── i18n.js             # Chaînes FR (structure DE prête)
├── data/
│   ├── words.json          # ≥ 60 mots (éditable)
│   └── keys.json           # 30 clés valides (statique, versionné)
├── tools/
│   ├── generate-keys.mjs   # (Re)génère data/keys.json
│   └── test-game.mjs       # Tests du moteur de jeu
└── README.md
```
