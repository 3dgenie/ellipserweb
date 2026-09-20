# ELlipserWeb

Browser-based photographic measurement and bloodstain ellipse documentation. It is a static HTML, CSS, and JavaScript app with no Node or npm dependencies. Images and measurements stay on the local device.

Public site: [ellipserweb.ai2-3d.com](https://ellipserweb.ai2-3d.com)

## Run locally

Open `index.html` in a modern browser (Chrome or Edge work best for save dialogs), or serve this folder:

```powershell
.\serve.ps1
```

That starts `http://127.0.0.1:8765/`. To preview the published copy instead:

```powershell
.\build-deploy.ps1
.\serve-dist.ps1
```

## File menu

| Command | What it does |
|---|---|
| **New** | Clears the current project (after a confirm) |
| **Open** | Opens a saved `.elp` project |
| **Save** | Saves the project as `.elp` (image plus measurements) |
| **Import → Image** | Loads one or more photos |
| **Export → CSV Report** | Spreadsheet of objects and stains |
| **Export → PDF Report** | Printable report including stain graphs |
| **Export → Marked Image** | PNG of the photo with overlays |

Save, CSV, PNG, and `.elp` use the system Save As dialog when the browser supports it; otherwise they download to the default folder. PDF uses the browser print dialog — choose **Save as PDF**.

Help (`?`) and Settings (gear) sit on the right of the top bar.

## Tools

**Select** (Esc or `V`) sits at the top of the rail. Use it to click objects without drawing a new one.

| Tool | Shortcut | Notes |
|---|---|---|
| Scale | `S` | Required before Auto Detect |
| Measure | `P` point, `D` distance, `A` angle | Triangle on the button switches variants |
| Circle | `C` | |
| Ellipse | `E` full, `H` half | Triangle on the button; **Assisted** is the stain wizard |
| Polyline | `L` | Right-click finishes |
| Polygon | `G` | Close by clicking the first point or right-click |
| Text | `T` | Click to place, then edit wording |

Undo / redo: `Ctrl+Z` / `Ctrl+Y`. Flip a selected ellipse: `F`. Delete: `Delete`.

Mouse wheel zooms. Right-click pans, except while drawing a polyline, polygon, or stain region (then it finishes the shape).

Selecting an object shows handles. Drag a handle to edit that point; drag elsewhere on the object to move it. **Locked** in Properties disables both.

## Half ellipse

A half ellipse fits only the well-defined front of a stain and doubles that length, so a distorted tail is less likely to bias the fit. Draw from the leading tip backwards. Labels on the canvas show **L · W · α · γ**. Properties report length (full, twice the fitted half), width, alpha, and gamma — not a separate half-length field.

## Stains (Assisted)

Needs a scale on the image. Open from the Ellipse triangle → **Assisted**, or **Reopen Stains** in Properties.

The wizard covers stain color, background, small/large size, **General Stain Direction** (drag toward the tails; leading edge at the start of the arrow), optional search and exclude regions, then Auto Detect. **Manually Mark** uses the same half-ellipse drag as the ellipse tool. `F` or Properties can flip a stain that faces the wrong way.

Each stain is a numbered half ellipse. Hover to highlight, click to edit, right-click or Delete to remove. Double-click the **Stains** row in Structure to collapse or expand the list. Deleting the Stains row removes all of its stains.

**Graphs** (from the Stains dialog or Properties) shows:

- Alpha histogram
- Width histogram
- Gamma rose (direction)
- Width vs alpha scatter

Click a small chart to open a larger view you can pan and zoom. Those graphs are included in the PDF report.

CSV stain columns include number, length, width, alpha, gamma, and auto vs manual.

## Settings

Gear button. Defaults for color, line width, point marker style, ellipse vertex handles, text size, and scale units apply to **new** objects only. Preferences live in this browser (`localStorage`), not in the `.elp` file.

**Load Sample Scene** is a labeled geometry scene. **Load Stain Scene** loads the HemoVision bloodstain photo for Auto Detect practice.

## Structure and panels

Tabs on Structure, Project, and the thumbnail strip collapse those panels so the canvas has more room. The left ‹ / › control collapses Structure and Properties together.

## Files in this folder

- `index.html`, `styles.css`, `app.js` — the application
- `build-deploy.ps1` — writes a compacted copy to `dist\`
- `serve.ps1` / `serve-dist.ps1` — local servers
- `samples\` — optional demo images (not copied into `dist`)

## Publishing to GitHub Pages

1. Run `build-deploy.ps1`. Upload **only** the files inside `dist\` (`index.html`, `styles.css`, `app.js`). Do not upload this README, the scripts, or `samples\`.
2. Put them in the GitHub Pages repo that serves [ellipserweb.ai2-3d.com](https://ellipserweb.ai2-3d.com) (currently `3dgenie.github.io`, custom domain already set).
3. If the site is in a subfolder, keep `index.html` at the web root of that folder.

The script strips comments and extra whitespace and adds a copyright banner. That is not encryption; anything the browser runs can be viewed. Identifier names are left readable because there is no Node/terser step on the development machine.

## Notes

This is a working prototype. Before operational or evidentiary use, measurements, coordinate transforms, file compatibility, browser behavior, and export accuracy should be formally tested and documented.
