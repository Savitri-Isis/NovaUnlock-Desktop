# Design — NovaUnlock Desktop

## Thème : Hacker Pro Dark

### Palette de couleurs

| Token | Couleur | Usage |
|-------|---------|-------|
| background | `#0A0A0F` | Fond principal |
| surface | `#12121A` | Cartes, panneaux, sidebar |
| foreground | `#E2E2F0` | Texte principal |
| muted | `#8B8B9E` | Texte secondaire, labels |
| border | `#1E1E2E` | Bordures, séparateurs |
| primary | `#7B2FBE` | Violet — actions principales, boutons |
| accent | `#00D4FF` | Cyan — highlights, badges, liens |
| success | `#00E676` | Vert — succès, connecté |
| warning | `#FFC107` | Jaune — avertissement, recovery |
| danger | `#FF1744` | Rouge — erreur, flash |

### Typographie

- **Sans-serif** : Segoe UI, system-ui (interface)
- **Monospace** : JetBrains Mono, Fira Code, Consolas (données techniques)

### Layout

- **Sidebar fixe** (256px) à gauche avec navigation
- **Contenu principal** à droite (flex-1)
- **Titre bar** : hiddenInset (style macOS/Windows moderne)

### Composants

- Cartes : `bg-surface rounded-2xl border border-border`
- Boutons : `rounded-xl py-3 font-semibold`
- Badges : `px-2 py-0.5 rounded text-xs font-mono`
- Progress bars : `h-2 bg-border rounded-full`

### Platform badge

Chaque écran affiche un badge indiquant la plateforme :
- Desktop : `Windows • node-hid • libimobiledevice`
