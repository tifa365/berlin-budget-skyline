# Berlin Budget City

This repo now runs a trimmed Three.js explorer that maps Berlin budget items into a city skyline.

## Structure

- `index.html`: the app shell and overlay UI.
- `assets/`: local runtime assets, including `three.min.js`, fonts, and favicon.
- `styles/app.css`: all presentation and responsive layout rules.
- `src/data/budget-data.js`: generated full Berlin budget dataset.
- `scripts/fetch-berlin-budget.py`: converts the official Berlin CSV into the runtime dataset.
- `src/core/`: scene setup, city layout, camera control, rendering helpers, and formatting utilities.
- `src/ui/`: search and inspector UI behavior.
- `archive/`: preserved originals from the downloaded monolith and fetch artifacts.

## Run

Serve the project with any static file server. Example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Scope

The active runtime keeps:

- the 3D city explorer
- search
- hover inspection
- budget item detail panel

It intentionally leaves out analytics, signup flows, plane mode, and generated audio.
