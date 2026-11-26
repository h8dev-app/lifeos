# LifeOS

Application de bureau local-first (Tauri v2 + Svelte 5) qui suit habitudes, tâches, notes et activité.
Elle tourne en fond et s'affiche en plein écran par-dessus tout avec un raccourci ; `Échap` la ferme.

État : **v1 complète** (jalons 1 à 7) : overlay, raccourci, `--toggle`, SQLite, catégories, commandes slash, tâches, notes Markdown, IA pour le texte libre, activité ActivityWatch + GitHub, panneau Claude Code, tableau de bord avec séries.

## Bilan hebdomadaire

Chaque lundi (au premier affichage de LifeOS), le bilan de la semaine passée est créé dans Notes : `bilan-2026-s48.md`.
- Les chiffres (entrées par catégorie, totaux de distance/durée/montant, tâches, temps d'ordinateur, séries) sont calculés par LifeOS.
- L'IA choisie dans les Réglages écrit seulement le texte : en bref, points forts, à améliorer, 3 objectifs en cases à cocher.
- À la main : `/bilan` (semaine en cours) ou `/bilan -1` (semaine dernière). Relancer remplace la note de la même semaine.
- Désactivable dans Réglages. Avec Ollama (`qwen2.5:3b`) la rédaction prend 1 à 2 min sur processeur et reste approximative ; un modèle Anthropic écrit mieux.

## Tableau de bord

Heure et date, séries en cours (« 🔥 3 jours de sport », en pointillés si la série attend l'entrée du jour), tâches du jour, dernières entrées, temps actif par appli (top 5), barre de saisie en bas.

## Saisie rapide

| Commande | Enregistre |
|---|---|
| `/sport course 5km 28min` | activité, distance, durée (`1h20`, `500m` acceptés) |
| `/commande ubereats 18€` | service, montant (`18,50€`, `18.5 €`) |
| `/cuisine pâtes carbo` | plat |
| `/devoirs maths 45min exercices p.12` | matière, durée, note |
| `/cat lecture 📖 livre:texte pages:nombre` | crée la catégorie `/lecture` |
| `/tache rendre le dossier @vendredi` | tâche du jour, échéance optionnelle |
| `/note Réunion BTS #Cours` | crée la note dans la catégorie Cours et l'ouvre (`/note` seul ouvre la vue Notes) |
| `/bilan` · `/bilan -1` | bilan de la semaine en cours / dernière, enregistré dans Notes |
| `/claude ~/projets/lifeos` | ouvre le panneau Claude Code dans ce dossier (`~/projets` par défaut) |

Types de champs pour `/cat` : `texte`, `distance`, `durée`, `euros`, `nombre`.
Survole une entrée récente pour la supprimer (×).

Échéances : `@auj`, `@demain`, `@après-demain`, `@lundi`…`@dimanche` (le prochain, aujourd'hui inclus), `@28/11`, `@28/11/2026`, `@2026-11-28`.

Vues : `Ctrl+1` Accueil, `Ctrl+2` Tâches, `Ctrl+3` Notes, `Ctrl+4` Activité, `Ctrl+5` Claude, `Ctrl+6` Réglages.

- **Activité** : temps actif par application (clic = détail par titre de fenêtre) et fil de la journée qui mélange saisies, pushs GitHub et activité. `←` / `→` pour changer de jour.

### Panneau Claude Code

`/claude [dossier]` ou l'onglet Claude lance le CLI officiel `claude` (déjà installé par toi) en mode interactif dans un terminal intégré, comme le terminal de VS Code. C'est toi qui tapes.

- Dans le terminal, `Échap` va à Claude (pour l'interrompre). `Maj+Échap` ferme l'overlay ; la session continue en fond.
- Changer de vue ou masquer l'overlay ne coupe pas la session. « Fermer la session » ou quitter LifeOS l'arrête.
- LifeOS ne lance que `claude` sans argument (jamais `-p` ni mode headless) et ne lit aucun identifiant Claude.
- Si `claude` est introuvable : message avec le lien d'installation officiel.

### Texte libre (IA)

Tout ce qui ne commence pas par `/` part vers l'IA choisie dans les Réglages, par ex. « j'ai couru 5 km ce matin en 28 min ».
L'IA propose une entrée (catégorie, valeurs, heure) : `Entrée` pour l'enregistrer, `Échap` pour l'annuler. Rien n'est enregistré sans confirmation.
Si l'IA est indisponible, seules les commandes `/…` marchent.

- **Tâches** : cocher, reporter à demain, supprimer. Une tâche non faite reste dans « Aujourd'hui » les jours suivants.
- **Notes** : fichiers `.md` dans le dossier `notes/` (modifiables avec n'importe quel éditeur), rangés par **catégorie** = sous-dossier (`notes/Cours/…`). Les bilans vont dans `Bilans`.
  - « ＋ Nouvelle note » demande un nom et une catégorie (existante ou nouvelle).
  - Cartes avec aperçu du texte, filtre par catégorie, recherche plein texte.
  - Dans une note : changer de catégorie, Écrire/Aperçu (`Ctrl+E`), corbeille, fermer (✕ ou `Échap`). Sauvegarde automatique.
  - Une note supprimée part dans `notes/.trash/`.

## Prérequis

- Node.js 22+ et npm
- Rust stable (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Fedora** :
  ```sh
  sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel \
    librsvg2-devel openssl-devel libsoup3-devel javascriptcoregtk4.1-devel libxdo-devel
  ```
- **Windows 11** : Microsoft C++ Build Tools (« Développement Desktop en C++ ») et WebView2 (déjà présent sur Windows 11).

## Lancer en développement

```sh
npm install
npm run tauri dev
```

L'appli démarre **cachée** : icône dans la zone de notification. Un clic gauche dessus affiche ou masque l'overlay.

## Tests

```sh
npm test                  # Vitest (logique TypeScript)
npm run check             # vérification des types
cd src-tauri && cargo test
```

## Build

```sh
npm run tauri build                     # tous les formats de la plateforme
npx tauri build --bundles rpm           # Fedora seulement
```

Installation sur Fedora :

```sh
sudo dnf install ./src-tauri/target/release/bundle/rpm/LifeOS-0.2.1-1.x86_64.rpm
```

Puis lance « LifeOS » une fois depuis le menu des applications : le démarrage automatique s'active (désactivable dans Réglages).
Pense à faire pointer le raccourci GNOME vers `lifeos --toggle`.

> La version de dev (`npm run tauri dev`) et la version installée partagent la même base et la même instance unique : quitte l'une avant de lancer l'autre.

- Windows : `src-tauri/target/release/bundle/nsis/*.exe` et `msi/*.msi`
- Fedora : `src-tauri/target/release/bundle/rpm/*.rpm`

La CI GitHub (`.github/workflows/build.yml`) construit les deux à chaque push.

## Afficher l'overlay

| Moyen | Windows | Fedora (Wayland) |
|---|---|---|
| `Ctrl+Alt+Espace` (raccourci de l'appli) | oui | non, GNOME bloque les raccourcis globaux des applis |
| Raccourci GNOME qui lance `lifeos --toggle` | — | oui |
| Clic sur l'icône du tray | oui | oui (voir note) |

`lifeos --toggle` envoie le signal à l'instance déjà lancée (plugin `single-instance`). Si aucune instance ne tourne, il la démarre et affiche l'overlay.

### Raccourci GNOME

Paramètres → Clavier → Raccourcis clavier → Afficher et personnaliser → Raccourcis personnalisés → `+` :

- Nom : `LifeOS`
- Commande : `lifeos --toggle` (appli installée via le `.rpm`)
  ou, en dev : `/chemin/vers/lifeos/src-tauri/target/debug/lifeos --toggle`
- Raccourci : `Ctrl+Alt+Espace`

Même chose en ligne de commande (remplace la commande si besoin) :

```sh
P=/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/lifeos/
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "['$P']"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$P name 'LifeOS'
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$P command 'lifeos --toggle'
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$P binding '<Control><Alt>space'
```

Attention : la première commande **remplace** la liste des raccourcis personnalisés existants. Si tu en as déjà, ajoute `'$P'` à la liste actuelle (`gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings`).

### Note tray sous GNOME

GNOME n'affiche pas d'icônes de tray par défaut. Installe l'extension « AppIndicator and KStatusNotifierItem Support » (`sudo dnf install gnome-shell-extension-appindicator`, puis active-la dans Extensions).

## Configurer l'IA

### Ollama (par défaut, gratuit, local)

```sh
curl -fsSL https://ollama.com/install.sh | sh   # Fedora/Linux ; Windows : installeur sur ollama.com
ollama pull qwen2.5:3b                          # ~2 Go
```

Ollama doit tourner sur `http://localhost:11434` (service lancé par l'installeur). Autre modèle : Réglages → Modèles.

### Anthropic / OpenAI (ta propre clé)

Réglages → Clés API → colle la clé → Enregistrer, puis choisis le fournisseur.
La clé va dans le trousseau système (Secret Service sous Fedora, Gestionnaire d'identifiants sous Windows). Le code JavaScript ne peut jamais la relire : seul Rust l'ajoute aux requêtes, et uniquement vers `api.anthropic.com` / `api.openai.com`.

Modèle Anthropic par défaut : `claude-opus-5-5`. `claude-haiku-5-5` coûte environ 40× moins cher et suffit pour cette tâche.

Test du prompt contre Ollama (optionnel) : `LIVE_OLLAMA=1 npx vitest run ollama.live`.

## Configurer l'activité

### ActivityWatch

LifeOS lit le serveur ActivityWatch local (`http://localhost:5600`) : fenêtre active et inactivité. Rien n'est copié dans la base, tout est lu en direct. Sans ActivityWatch, la vue Activité affiche un message et montre quand même les saisies.

Téléchargement : https://activitywatch.net/downloads/

**GNOME Wayland** : le suivi des fenêtres d'origine ne voit pas les applis Wayland. Il faut `awatcher` (https://github.com/2e3s/awatcher) avec l'extension GNOME qu'il demande, à la place de `aw-watcher-window` / `aw-watcher-afk`. LifeOS lit les deux de la même façon.

### GitHub

Réglages → GitHub → ton pseudo. Les pushs publics sont ajoutés à la catégorie **Code** toutes les 10 minutes (et au lancement), sans doublon.
Depuis 2025, GitHub ne donne plus le nombre de commits dans ses événements : LifeOS le récupère via l'API de comparaison pour les nouveaux pushs (10 max par synchro).
Optionnel : un token GitHub (Réglages → Clés API), stocké dans le trousseau, augmente la limite de 60 à 5 000 requêtes/heure.

## Démarrage automatique

Activé automatiquement au premier lancement d'un **build de release** (pas en dev) :

- Windows : clé `HKCU\…\Run`
- Fedora : `~/.config/autostart/LifeOS.desktop`

## Données utilisateur

- Windows : `%APPDATA%\com.henri.lifeos\`
- Fedora : `~/.local/share/com.henri.lifeos/`

Contenu : `lifeos.db` (SQLite), `notes/` (fichiers Markdown), `settings.json` (réglages non sensibles). Les clés API sont dans le trousseau système, pas dans ce dossier.
