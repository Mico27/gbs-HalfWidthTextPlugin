# gbs-HalfWidthTextPlugin

GB Studio 4.3.0 engine plugin that draws **4px-wide (half-width) text — two characters per background tile** — using the technique from *Pokémon Trading Card Game* (GB). Glyphs come from a regular GB Studio **font asset**, so the font is edited like any other font and characters are mapped through the font JSON's `table` field.

## The poketcg technique

Pokémon TCG renders its small font like this:

1. Half-width characters are consumed **in pairs** (left char + right char). Each 4px glyph is composed into a single 8x8 tile with `left_row | (right_row >> 4)`.
2. Before composing, the pair is looked up in an **LRU cache**: a doubly-linked list keyed by the two characters, where each entry owns one VRAM tile in a reserved range. On a **hit**, the entry is hoisted to the head of the list and its existing VRAM tile index is written to the tilemap — no tile data is copied. On a **miss**, a fresh tile is allocated, or if the range is full, the **least recently used** pair's tile is evicted and overwritten.
3. Text ending mid-pair (end of string, newline, mode switch) is padded with a half-width space.

This plugin is a faithful C reimplementation of that mechanism on top of GB Studio's font and text pipeline.



https://github.com/user-attachments/assets/a66f1b0d-80d3-4902-87c8-072a7697df88



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
| **Half-Width Text: Set Tile Range** | Changes the reserved VRAM tile range and tile placement (bank 0 / bank 1 / alternate) at runtime and resets the cache. |

### Supported control codes

The renderer handles the stock `ui_text_data` control-code set: `\001` text speed, `\002` font switch (temporary within the text, like stock — switching fonts also resets the pair cache), `\003`/`\004` gotoxy / relative gotoxy (tile coordinates), `\005` escape, `\006` wait-for-input, `\013` CGB palette, `\n` newline, `\r` newline-with-scroll. `\007` text color and `\010` direction are skipped (half-width text always renders black-on-white, left-to-right, like poketcg). GB Studio variables (`$Variable$`) are resolved by the engine before rendering.

## Engine fields (Settings → Half-Width Text)

| Field | Default | Meaning |
|---|---|---|
| `hwt_first_tile` | 128 | First background tile index reserved for pair tiles. |
| `hwt_last_tile` | 191 | Last reserved tile index (inclusive). At most `HWT_CACHE_MAX` tiles are used. |
| `hwt_tile_placement` | Bank 0 only | Which VRAM tile data bank the pair tiles are uploaded to: **Bank 0 only**, **Bank 1 only (Color)** or **Alternate bank 0/1 (Color)**. See *Tile placement* below. |
| `HWT_CACHE_MAX` | 64 | Pair-cache capacity (4–128 entries). Compile-time define: each entry costs 4 bytes of WRAM, so lowering it reclaims WRAM; raising it only helps together with a larger reserved tile range (usable entries = min(`HWT_CACHE_MAX`, range size)). |

**Choosing the range:** scene background tilesets occupy tiles from 0 upward (up to 191); GB Studio UI frame/cursor/dialogue VWF tiles occupy 192–255. The default 128–191 is safe for scenes whose tileset uses fewer than 128 unique tiles. Adjust per scene with *Set Tile Range* if needed.

**Tile placement (Game Boy Color):** on CGB the tilemap attribute byte's bit 3 selects which VRAM tile data bank a map cell reads from, and the plugin sets it per character cell. *Bank 1 only* stores every pair tile in bank 1, so the reserved indices stop competing with bank-0 scene tiles entirely; *Alternate bank 0/1* stores entries in both banks, so the same index range holds **twice** as many pairs (usable entries = min(`HWT_CACHE_MAX`, 2 × range size)). Both options are meant for Color Only mode (they also work in mixed color modes when running on GBC); on DMG hardware the plugin automatically falls back to *Bank 0 only*. In Color Only mode scene backgrounds may themselves use bank-1 tiles — pick a range whose bank-1 indices are free too.

## Making a half-width font

A half-width font is a normal GB Studio font asset (`assets/fonts/name.png` + `name.json`) with three rules:

1. **Each glyph occupies only the left 4 pixels of its 8x8 tile** (the renderer masks to the left nibble and packs two glyphs per tile).
2. **Use a non-transparent white background** — RGB (240,240,240) works; pure white (255,255,255) counts as *transparent* to the font compiler, which then trims and left-shifts the glyphs, destroying your spacing.
3. Map characters with the JSON **`table`** field when the image layout isn't plain ASCII order: `"table": { "é": 69 }` maps `é` to glyph 69 (tile position in the image, counted left-to-right top-to-bottom — valid as long as all tiles in the image are unique, since GB Studio deduplicates identical tiles). See `font/halfwidth.json` for a working example that maps accented characters onto their base glyphs.

Fonts laid out as 96 tiles (rows of 16, starting at space) get an automatic ASCII mapping — the `table` is only needed for extras.

## Notes / caveats

- The cache holds up to `HWT_CACHE_MAX` (default 64) character pairs. When full, the least recently used pair's tile is reused — text drawn long ago may visually corrupt if still on screen while many new pairs are drawn. Size the range for the amount of distinct text you keep on screen.
- Switching fonts (event or `\002` code) resets the pair cache; tiles already on screen keep their pixels until their slot is reused.
- On CGB the current text palette and overlay priority are applied to the drawn tiles.
- Coordinates are tilemap coordinates (0–31); on scrolling scenes the background layer wraps within the 32×32 map like the stock text renderer.

## Example projects

`halfWidthTextPluginExample/` — instant draws (including json-table accents), a typed-out line, and a scrolling half-width dialogue box (mono mode).

`halfWidthTextPluginColorExample/` — Color Only mode version demonstrating the tile placement feature: draws with *Bank 1 only* placement, then switches to *Alternate bank 0/1* (via the Set Tile Range event) for the typed-out text and the dialogue. Builds to a CGB-only ROM.

---

## Memory Footprint

Measured against the stock GB Studio **4.3.0-e1** engine (per-file SDCC compile with GB Studio's build flags, default engine settings). Values are the plugin's *delta* versus the stock engine; DMG build, with CGB noted where it differs. ROM cost lands in banked ROM (GB Studio's autobanker spreads it across switchable banks); using the plugin's events additionally compiles a few bytes of GBVM script per call into your project's script banks.

| | Cost |
|---|---|
| WRAM | +324 bytes |
| ROM | +2,158 bytes (DMG) / +2,257 bytes (CGB) |

- **WRAM:** 324 bytes — the poketcg-style pair-tile LRU cache tables in `half_width_text.c`. Scales with the `HWT_CACHE_MAX` engine field at 4 bytes per entry (default 64 entries; e.g. 32 entries saves 128 bytes).
- **Engine WRAM headroom:** the stock GB Studio 4.3.0 engine leaves about **854 bytes** of WRAM free (usable engine WRAM is 7,776 bytes at 0xC0A0–0xDF00; the stock engine uses 6,922 bytes). With this plugin installed roughly **530 bytes** remain. This figure does not depend on how many global variables your project defines: the script memory array has a fixed size of VM_HEAP_SIZE + (VM_MAX_CONTEXTS × VM_CONTEXT_STACK_SIZE) words — 768 + 16 × 64 = 1,792 words (3,584 bytes) with stock engine settings.
- **SRAM:** not used.
