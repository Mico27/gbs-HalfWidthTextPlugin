# gbs-HalfWidthTextPlugin

GB Studio 4.3.0 engine plugin that draws **4px-wide (half-width) text — two characters per background tile** — using the technique from *Pokémon Trading Card Game* (GB). Glyphs come from a regular GB Studio **font asset**, so the font is edited like any other font and characters are mapped through the font JSON's `table` field.

## The poketcg technique

Pokémon TCG renders its small font like this:

1. Half-width characters are consumed **in pairs** (left char + right char). Each 4px glyph is composed into a single 8x8 tile with `left_row | (right_row >> 4)`.
2. Before composing, the pair is looked up in an **LRU cache**: a doubly-linked list keyed by the two characters, where each entry owns one VRAM tile in a reserved range. On a **hit**, the entry is hoisted to the head of the list and its existing VRAM tile index is written to the tilemap — no tile data is copied. On a **miss**, a fresh tile is allocated, or if the range is full, the **least recently used** pair's tile is evicted and overwritten.
3. Text ending mid-pair (end of string, newline, mode switch) is padded with a half-width space.

This plugin is a faithful C reimplementation of that mechanism on top of GB Studio's font and text pipeline.

## Installation

1. Copy `src/HalfWidthTextPlugin` into your project's `plugins/` folder.
2. Copy `font/halfwidth.png` + `font/halfwidth.json` into your project's `assets/fonts/` folder (or make your own half-width font — see below). This is the original poketcg half-width font.
3. In your scripts, **Set Font** to the half-width font before drawing (the plugin reads glyphs from the *current* font).

## Events

| Event | What it does |
|---|---|
| **Half-Width Text: Draw To Background** | Instantly draws the text at X/Y (in tiles) on the background layer. |
| **Half-Width Text: Draw To Overlay** | Same, on the overlay (window) layer. |
| **Half-Width Text: Draw At Text Speed** | Types the text out at the current text speed on the background or overlay. A/B fast-forwards, blocks until done (actors keep updating). |
| **Half-Width Text: Display Dialogue** | Full dialogue box like the stock Display Dialogue: overlay slides in, text types out at text speed, scrolls past its scroll height, closes on button / when finished / never (non-modal). 40 characters per line. |
| **Half-Width Text: Reset Tile Cache** | Forgets all cached pair tiles. **Call in each scene's On Init** — scene loads overwrite VRAM, so a stale cache would map text to garbage tiles. |
| **Half-Width Text: Set Tile Range** | Changes the reserved VRAM tile range at runtime and resets the cache. |

### Supported control codes

The renderer handles the stock `ui_text_data` control-code set: `\001` text speed, `\002` font switch (temporary within the text, like stock — switching fonts also resets the pair cache), `\003`/`\004` gotoxy / relative gotoxy (tile coordinates), `\005` escape, `\006` wait-for-input, `\013` CGB palette, `\n` newline, `\r` newline-with-scroll. `\007` text color and `\010` direction are skipped (half-width text always renders black-on-white, left-to-right, like poketcg). GB Studio variables (`$Variable$`) are resolved by the engine before rendering.

## Engine fields (Settings → Half-Width Text)

| Field | Default | Meaning |
|---|---|---|
| `hwt_first_tile` | 128 | First background tile index reserved for pair tiles. |
| `hwt_last_tile` | 191 | Last reserved tile index (inclusive). Max 64 tiles are used. |

**Choosing the range:** scene background tilesets occupy tiles from 0 upward (up to 191); GB Studio UI frame/cursor/dialogue VWF tiles occupy 192–255. The default 128–191 is safe for scenes whose tileset uses fewer than 128 unique tiles. Adjust per scene with *Set Tile Range* if needed.

## Making a half-width font

A half-width font is a normal GB Studio font asset (`assets/fonts/name.png` + `name.json`) with three rules:

1. **Each glyph occupies only the left 4 pixels of its 8x8 tile** (the renderer masks to the left nibble and packs two glyphs per tile).
2. **Use a non-transparent white background** — RGB (240,240,240) works; pure white (255,255,255) counts as *transparent* to the font compiler, which then trims and left-shifts the glyphs, destroying your spacing.
3. Map characters with the JSON **`table`** field when the image layout isn't plain ASCII order: `"table": { "é": 69 }` maps `é` to glyph 69 (tile position in the image, counted left-to-right top-to-bottom — valid as long as all tiles in the image are unique, since GB Studio deduplicates identical tiles). See `font/halfwidth.json` for a working example that maps accented characters onto their base glyphs.

Fonts laid out as 96 tiles (rows of 16, starting at space) get an automatic ASCII mapping — the `table` is only needed for extras.

## Notes / caveats

- The cache holds up to 64 character pairs. When full, the least recently used pair's tile is reused — text drawn long ago may visually corrupt if still on screen while many new pairs are drawn. Size the range for the amount of distinct text you keep on screen.
- Switching fonts (event or `\002` code) resets the pair cache; tiles already on screen keep their pixels until their slot is reused.
- On CGB the current text palette and overlay priority are applied to the drawn tiles.
- Coordinates are tilemap coordinates (0–31); on scrolling scenes the background layer wraps within the 32×32 map like the stock text renderer.

## Example project

`halfWidthTextPluginExample/` — instant draws (including json-table accents), a typed-out line, and a scrolling half-width dialogue box.
