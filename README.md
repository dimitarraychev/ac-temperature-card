# AC Temperature Card

A single, borderless Lovelace card with `−` / `+` buttons and a large centered target temperature for any `climate` entity.

## Install (HACS)
1. Push these three files to a GitHub repo (root of the repo).
2. HACS → ⋮ → **Custom repositories** → add your repo URL, category **Dashboard**.
3. Download it, then hard-refresh the browser.

## Usage
```yaml
type: custom:ac-temperature-card
entity: climate.living_room_air_conditioner
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | A `climate` entity |
| `name` | none | Small label under the temperature |
| `step` | entity's `target_temp_step`, else `1` | Amount per tap |
| `show_current` | `true` | Show current room temperature |
| `color` | by HVAC mode | Accent color override |

Taps are debounced (600 ms), so pressing + several times sends one command. Tap the temperature to open the more-info dialog.
