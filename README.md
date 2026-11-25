# LifeOS

Application de bureau local-first (Tauri v2 + Svelte 5) qui suit habitudes, tâches, notes et activité.
Elle tourne en fond et s'affiche en plein écran par-dessus tout avec un raccourci ; `Échap` la ferme.

État : **jalon 3** (overlay, raccourci, `--toggle`, CI, SQLite, catégories, commandes slash, tâches, notes Markdown).

## Saisie rapide

| Commande | Enregistre |
|---|---|
| `/sport course 5km 28min` | activité, distance, durée (`1h20`, `500m` acceptés) |
| `/commande ubereats 18€` | service, montant (`18,50€`, `18.5 €`) |
| `/cuisine pâtes carbo` | plat |
| `/devoirs maths 45min exercices p.12` | matière, durée, note |
| `/cat lecture 📖 livre:texte pages:nombre` | crée la catégorie `/lecture` |
| `/tache rendre le dossier @vendredi` | tâche du jour, échéance optionnelle |
| `/note Réunion BTS` | crée la note et l'ouvre (`/note` seul ouvre la vue Notes) |

Types de champs pour `/cat` : `texte`, `distance`, `durée`, `euros`, `nombre`.
Survole une entrée récente pour la supprimer (×).

Échéances : `@auj`, `@demain`, `@après-demain`, `@lundi`…`@dimanche` (le prochain, aujourd'hui inclus), `@28/11`, `@28/11/2026`, `@2026-11-28`.

Vues : `Ctrl+1` Accueil, `Ctrl+2` Tâches, `Ctrl+3` Notes.

- **Tâches** : cocher, reporter à demain, supprimer. Une tâche non faite reste dans « Aujourd'hui » les jours suivants.
- **Notes** : fichiers `.md` dans le dossier `notes/` (modifiables avec n'importe quel éditeur). Sauvegarde automatique, aperçu avec `Ctrl+E`, recherche plein texte. Une note supprimée part dans `notes/.trash/`.

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
npm run tauri build
```

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

## Démarrage automatique

Activé automatiquement au premier lancement d'un **build de release** (pas en dev) :

- Windows : clé `HKCU\…\Run`
- Fedora : `~/.config/autostart/LifeOS.desktop`

## Données utilisateur

- Windows : `%APPDATA%\com.henri.lifeos\`
- Fedora : `~/.local/share/com.henri.lifeos/`

Contenu : `lifeos.db` (SQLite) et `notes/` (fichiers Markdown).
