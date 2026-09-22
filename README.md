# Suivi des Ventes

Petit site admin pour enregistrer tes ventes, suivre les dettes et savoir
combien d'argent est réellement encaissé — sans gestion de stock.

Construit en HTML / CSS / JS pur (aucune étape de build), avec un design
system fait main dans l'esprit de shadcn/ui.

## Ce que fait le site

- **Enregistrer une vente** : nom du client, montant, description (par
  défaut « Fournitures scolaires »), cash ou crédit, et une date modifiable
  (utile pour rattraper les ventes déjà faites avant la mise en place du site).
  Pour une vente à crédit, tu peux aussi indiquer une **avance** déjà reçue
  (ex : le client paie une partie tout de suite et le reste plus tard) — la
  vente apparaît alors directement dans les dettes avec le bon solde restant.
- **Tableau de bord** : ventes du jour, montant encaissé aujourd'hui, chiffre
  d'affaires et montant réellement encaissé sur une période (jour / semaine /
  mois / tout), total des dettes restantes, graphique des ventes des 14
  derniers jours.
- **Dettes** : liste des clients qui doivent encore de l'argent, avec un
  bouton pour encaisser une partie ou la totalité, et un badge d'ancienneté
  (combien de jours depuis la vente) qui devient orange puis rouge quand une
  dette traîne. Dès qu'une dette est totalement réglée, elle disparaît
  automatiquement de la liste (mais la vente reste dans l'historique et dans
  le chiffre d'affaires).
- **Modifier une vente** : un bouton crayon sur les lignes de vente (dettes
  et historique) permet de corriger une erreur de saisie (montant,
  description, date, client). Le passage cash ↔ crédit est géré
  automatiquement, mais reste bloqué quand ça créerait une incohérence (ex :
  repasser en « cash » une vente à crédit déjà partiellement encaissée).
- **Vue par client** : un onglet dédié qui regroupe les ventes par client
  (total acheté, total encaissé, solde dû), avec une recherche par nom et un
  détail complet au clic sur un client.
- **Export CSV** : bouton dans l'historique des ventes pour exporter (en
  respectant les filtres de date actifs) toutes les ventes dans un fichier
  `.csv` compatible Excel, à garder pour ta comptabilité ou à partager.
- **Mot de passe oublié** : lien sur l'écran de connexion pour recevoir un
  email de réinitialisation.
- **Synchronisation en temps réel** : si tu ouvres le site sur ton
  téléphone et ton ordinateur en même temps, une vente ou un encaissement
  fait sur l'un apparaît automatiquement sur l'autre, sans recharger la page.
- **Connexion** : protégée par email + mot de passe (un seul compte).

## Pourquoi cette architecture (et pas juste des fichiers locaux)

Comme tu veux pouvoir enregistrer et consulter tes ventes depuis plusieurs
appareils avec les mêmes données, il faut une vraie base de données en
ligne — un simple fichier HTML ne suffit pas. Voici ce que je te propose,
en visant le plus simple possible :

| Brique | Choix | Pourquoi |
|---|---|---|
| Base de données + authentification | **Supabase** (gratuit) | Te donne une vraie base Postgres et un système de connexion sécurisé, sans écrire une seule ligne de backend. Le site JS parle directement à Supabase. |
| Hébergement du site (fichiers HTML/CSS/JS) | **Netlify** (gratuit) | Dépose le dossier, tu obtiens une adresse en `https://` en 30 secondes. Pas de configuration serveur. |

Cette combinaison est gratuite pour ton usage (un petit commerce, quelques
ventes par jour) et ne demande aucune maintenance de serveur de ta part.

## Mise en place (une seule fois)

### 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), crée un compte, puis un
   nouveau projet (choisis une région proche, ex. US East).
2. Une fois le projet créé, ouvre **SQL Editor** (menu de gauche), colle le
   contenu du fichier `schema.sql` fourni ici, et exécute-le. Cela crée les
   tables `ventes` et `paiements`, avec les règles de sécurité.
3. Va dans **Authentication > Users > Add user**, et crée ton compte
   (email + mot de passe). C'est avec ces identifiants que tu te connecteras
   sur le site — il n'y a pas de formulaire d'inscription, uniquement une
   page de connexion.
4. Va dans **Project Settings > API Keys**. Note :
   - **Project URL**
   - **Publishable key** (commence par `sb_publishable_...` — sur un projet
     plus ancien, elle peut s'appeler « anon public »). C'est celle-ci qui
     va dans `config.js`. Ne prends jamais la **Secret key**
     (`sb_secret_...`) : elle ne doit jamais se retrouver dans un fichier
     accessible depuis le navigateur.
5. Pour que le lien « mot de passe oublié » fonctionne, va dans
   **Authentication > URL Configuration** et ajoute l'adresse de ton site
   une fois en ligne (ex. `https://tonpseudo.github.io/ventes-admin/`) dans
   **Redirect URLs**. Tant que le site n'est pas encore en ligne, tu peux
   laisser cette étape pour plus tard et y revenir après l'hébergement
   (section 3 ci-dessous).

> **Si ton projet Supabase existait déjà avant cette mise à jour** (avant
> les fonctionnalités d'édition, de recherche client, d'export CSV, etc.) :
> il suffit de ré-exécuter le nouveau `schema.sql` dans le SQL Editor — il
> est conçu pour être rejoué sans danger sur une base existante — afin
> d'activer la synchronisation en temps réel entre appareils. Rien n'est
> supprimé ni recréé.

### 2. Configurer le site

Ouvre `config.js` et remplace les deux valeurs par celles récupérées à
l'étape précédente :

```js
window.SUPABASE_URL = "https://xxxxxxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

### 3. Héberger le site

Le dossier contient uniquement des fichiers statiques
(`index.html`, `style.css`, `app.js`, `config.js`) : il peut être hébergé
n'importe où. Le plus simple :

**Option A — Netlify Drop (le plus rapide)**
1. Va sur [app.netlify.com/drop](https://app.netlify.com/drop).
2. Fais glisser le dossier `ventes-admin` (celui qui contient `index.html`)
   directement dans la page.
3. Ton site est en ligne avec une adresse `https://....netlify.app`.
   Tu peux la renommer ou brancher un nom de domaine plus tard, gratuitement.

**Option B — Vercel ou GitHub Pages**
Fonctionnent tout aussi bien pour un site 100 % statique comme celui-ci ;
utilise Netlify Drop si tu veux la mise en ligne la plus rapide sans compte
GitHub.

Une fois en ligne, ouvre l'adresse, connecte-toi avec le compte créé à
l'étape 1.3, et tu peux commencer à enregistrer tes ventes depuis
n'importe quel appareil (téléphone, ordinateur), les données restant
synchronisées entre eux.

## Comment fonctionne le calcul des dettes

Pour rester simple et cohérent, chaque vente **cash** reçoit automatiquement
un encaissement égal à son montant dès sa création (elle est donc
« payée » immédiatement). Une vente **à crédit** ne reçoit un encaissement
que lorsque tu cliques sur « Encaisser ». Le montant restant à payer d'une
vente est donc toujours : `montant de la vente − somme des encaissements
liés à cette vente`. Dès que ce reste atteint 0, la vente sort
automatiquement de la liste des dettes.

## Évolutions faciles plus tard

L'architecture (Supabase + règles de sécurité par compte) est faite pour
grandir sans tout refaire :
- ajouter d'autres membres de l'équipe avec leur propre connexion (rôles /
  permissions) ;
- ajouter un mode hors-ligne (file d'attente locale + synchronisation) pour
  continuer à enregistrer des ventes sans connexion internet ;
- ajouter la gestion du stock si le besoin apparaît ;
- passer à une stack React/shadcn plus tard si le projet prend de l'ampleur
  (le modèle de données Supabase resterait le même).

Ces deux premiers points (rôles multi-utilisateurs et mode hors-ligne)
demandent chacun une vraie réflexion de conception avant de coder — on en
reparle quand tu seras prêt à les aborder.

## Fichiers du projet

```
ventes-admin/
├── index.html     Structure de la page (connexion + application)
├── style.css      Design system (couleurs, composants, thème clair/sombre auto)
├── app.js         Toute la logique (connexion, calculs, tableau de bord, actions)
├── config.js      Tes identifiants Supabase (à remplir)
├── schema.sql      Script à exécuter une fois dans Supabase
└── README.md       Ce document
```