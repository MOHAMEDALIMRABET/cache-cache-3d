# 🙈 Cache-Cache 3D

Jeu de cache-cache en 3D, **solo (contre des bots)** ou **en ligne jusqu'à 8 joueurs**.

## Publier l'application web (lien public, installable, comme DefiMemory)

L'application est hébergée gratuitement sur **Firebase** (offre Spark), à une adresse du type `https://cache-cache-3d.web.app`.
N'importe qui peut jouer avec ce lien, sans compte, sur ordinateur ou téléphone. On peut aussi l'**installer** comme une application
(« Ajouter à l'écran d'accueil »), et le solo marche même sans Internet.

### 1. Créer le projet Firebase (une seule fois, environ 5 minutes)
1. Va sur https://console.firebase.google.com puis **Ajouter un projet** (par exemple `cache-cache-3d`). Google Analytics n'est pas utile.
2. **Build > Authentication > Commencer**, onglet **Sign-in method** : active **Anonyme**.
3. **Build > Realtime Database > Créer une base de données** : choisis l'emplacement **europe-west1 (Belgique)**, puis démarre en **mode verrouillé**.
4. **Paramètres du projet** (roue dentée) **> Vos applications > icône Web `</>`** : donne un nom, puis copie l'objet `firebaseConfig`.
5. Colle-le dans `public/firebase-config.js` à la place de `null`. Vérifie que `databaseURL` est bien présent.

### 2. Mettre en ligne (à refaire à chaque modification)
```bash
npm install
npx firebase-tools login                 # une seule fois : ouvre le navigateur pour te connecter à Google
npx firebase-tools use --add             # une seule fois : choisis ton projet, alias « default »
npm run deploy                           # construit dist/ puis publie le site ET les règles de la base
```
L'adresse du jeu s'affiche à la fin (`Hosting URL`).

### 3. Relier la page claude.ai au jeu complet
Mets cette adresse dans `WEB_URL` (fichier `public/firebase-config.js`), puis lance `npm run build:artifact` et republie le dossier `artifact/`.
Tu peux aussi simplement me donner l'adresse : je m'en occupe.
La page claude.ai affichera alors le bouton **« Ouvrir le jeu complet »**, comme DefiMemory.

### Fonctionnement en ligne
Le joueur qui crée la partie est l'**hôte** : son appareil fait tourner les règles et les bots, puis publie l'état du jeu dans Firebase environ 10 fois par seconde.
Les autres envoient leurs déplacements et leurs actions. Les parties ouvertes apparaissent sur l'accueil, et le bouton **« Inviter des amis »** partage le lien direct de la partie.
Les entrées d'un joueur sont effacées automatiquement quand il se déconnecte.
L'hôte doit garder le jeu ouvert et au premier plan jusqu'à la fin (sur téléphone, changer d'application met la partie en pause).

## Jouer en ligne sur claude.ai (sans rien installer)

Le jeu est publié ici : https://claude.ai/artifact/HpMAR2AwwaygtYqnrHHtUK

1. Ouvre le lien, puis invite tes amis avec le menu **Partager** de la page (ils doivent avoir un compte Claude et être connectés ; un lien public ne suffit pas pour le mode en ligne).
2. Un joueur clique sur **Créer une partie en ligne** ; il devient l'hôte (son navigateur fait tourner la partie et les bots).
3. Les autres voient la partie dans **Parties ouvertes** (ou tapent le code à 4 lettres) et cliquent sur **Rejoindre**.
4. L'hôte doit garder la page ouverte jusqu'à la fin : s'il la ferme, la partie s'arrête pour tout le monde.

Pour republier après une modification : `node build-artifact.mjs`, puis publier `artifact/`.

## Lancer le jeu avec son propre serveur

Il faut [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
npm start
```

Ouvre ensuite **http://localhost:3000** dans ton navigateur.

- **Solo** : clique sur « Jouer en solo » ; tu peux ajouter ou retirer des bots dans le salon.
- **En ligne (même Wi-Fi)** : un joueur clique sur « Créer une partie en ligne » et donne le **code à 4 lettres** (ou le lien).
  Les autres ouvrent `http://<adresse-IP-de-l-ordinateur-serveur>:3000` et cliquent sur « Rejoindre ».
- **En ligne (par Internet)** : héberge le dossier sur un service Node.js (Render, Railway, Fly.io…) ou expose le port 3000 avec un tunnel (ngrok, cloudflared).

## Commandes

| Action | Clavier / souris | Mobile |
|---|---|---|
| Bouger | ZQSD, WASD ou flèches | joystick à gauche |
| Caméra | clic-glisser, molette pour zoomer | glisser l'écran |
| Se cacher / sortir / fouiller | **E**, Espace ou Entrée | bouton **E** |

## Déroulement d'une manche

1. **Salon** : chacun choisit son personnage (chacun est unique) parmi les 11 : Mario, Luigi, Peach, Schtroumpf Costaud, Schtroumpf à lunettes, Schtroumpfette, Schtroumpf Maladroit, Schtroumpf Sauvage, Taoki le dragon, Lili et Hugo.
2. **Tirage au sort** : un **chercheur** est tiré au hasard (en priorité parmi ceux qui ont le moins cherché, pour que chacun cherche à son tour). Il devient **rouge** avec un anneau rouge. Un **environnement** est aussi tiré au hasard : Désert, Ville, Parc ou Grande Maison (jamais deux fois de suite le même).
3. **30 s pour se cacher** : le chercheur a l'écran noir et compte. Les autres reçoivent une liste de **cachettes proposées** (bouton « Autres idées » pour en voir d'autres) ou se promènent et appuient sur E près d'une cachette (repérée par 👀). Une cachette = un seul joueur.
4. **Recherche** : le chercheur a **2 min + 30 s par joueur caché, 6 min maximum** (soit 2 min 30 pour 1 caché, 5 min 30 à 8 joueurs).
   - Il **fouille** une cachette avec E : si quelqu'un est dedans, il est trouvé.
   - Un joueur **visible** (pas dans une cachette) est trouvé s'il est **touché**.
   - Fouiller une cachette **vide coûte 5 secondes** au chronomètre (pas de fouille au hasard partout !).
   - **Dernière minute** : toutes les 15 s, une cachette occupée « **éternue** » (elle tremble et affiche « Atchoum ! »).
   - Un caché peut **sortir** et changer de cachette, mais il est visible pendant qu'il court.
   - Les joueurs trouvés vont sur le « banc des trouvés » et suivent le chercheur.

## Points (gains et pertes)

| Rôle | Situation | Points |
|---|---|---|
| Chercheur | chaque joueur trouvé | **+100** |
| Chercheur | tout le monde trouvé avant la fin | **+150** + **2 pts par seconde restante** |
| Chercheur | fouille d'une cachette vide | **−5 s** au chronomètre |
| Caché | chaque seconde passée sans être trouvé | **+1** |
| Caché | jamais trouvé (survivant) | **+150** |
| Caché | dernier trouvé (si le chercheur gagne) | **+50** |

- Le **chercheur gagne la manche** s'il trouve tout le monde ; sinon ce sont **les survivants** qui gagnent.
- Le nombre de manches est réglable (1 à 8) ; après la dernière, le **classement final** affiche le podium 🏆.

### Pourquoi ces durées ?
6 minutes fixes, c'est trop long à 2 joueurs et un peu juste à 8. Le temps augmente donc avec le nombre de cachés.
Les bots ont été réglés par simulation pour que le chercheur-bot gagne environ une manche sur deux (plus souvent quand il n’y a qu’un seul caché).

## Organisation du code

```
server.js                 serveur HTTP + WebSocket (salles en ligne, 20 mises à jour/s)
build-artifact.mjs        assemble la version claude.ai dans artifact/
build-web.mjs             assemble l'application web dans dist/ (Firebase Hosting)
firebase.json             hébergement + règles ; database.rules.json = règles de sécurité de la base
public/firebase-config.js configuration Firebase + adresse du jeu complet
public/js/net-firebase.js mode en ligne de l'application web (Firebase Realtime Database)
public/sw.js, manifest.webmanifest, icons/   application installable (PWA), solo hors ligne
public/js/net-room.js     mode en ligne claude.ai (salle temps réel, le navigateur de l'hôte fait autorité)
public/index.html         écrans (accueil, salon, tirage, jeu, résultats)
public/style.css
public/shared/core.js     règles, cartes, collisions, points et bots (utilisé par le serveur ET le mode solo)
public/js/main.js         interface, commandes, caméra, réseau
public/js/characters.js   personnages 3D (formes géométriques, aucune image externe)
public/js/world.js        rendu des 4 environnements
```

Avec le serveur Node, le serveur fait autorité : le chercheur ne reçoit jamais la position des joueurs cachés. Sur claude.ai, c'est le navigateur de l'hôte qui fait autorité ; l'interface du chercheur masque les cachés, mais un joueur très bricoleur pourrait lire l'état brut (sans importance entre amis).

> Les personnages sont des hommages faits en formes simples, pour un usage personnel. Mario, Luigi, Peach (Nintendo), les Schtroumpfs (Peyo/IMPS) et Taoki, Lili et Hugo (Hachette Éducation) appartiennent à leurs ayants droit : il faut leur autorisation pour publier ou vendre le jeu.
