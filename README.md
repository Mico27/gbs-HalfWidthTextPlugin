# gbs-HalfWidthTextPlugin

**Version 4.3.0 — Requires GB Studio ≥ 4.3.0**

A GB Studio engine plugin that draws **4px-wide (half-width) text — two characters per background tile** — using the technique from *Pokémon Trading Card Game* (GB). Glyphs come from a regular GB Studio **font asset**, so the font is edited like any other font, and characters are mapped through the font JSON's `table` field.

Fitting two characters into every tile roughly doubles how much text a dialogue box holds: a framed line takes 40 characters instead of 18.

https://github.com/user-attachments/assets/a66f1b0d-80d3-4902-87c8-072a7697df88

---

## Table of Contents

1. [Concepts](#concepts)
2. [Project Setup](#project-setup)
3. [Engine Settings](#engine-settings)
4. [Size Limits and Restrictions](#size-limits-and-restrictions)
5. [Events Reference](#events-reference)
6. [Media](#media)
7. [Memory Footprint](#memory-footprint)

---

## Concepts

### Character pairs and the tile cache

The Game Boy background is made of 8×8 tiles, so a 4px-wide character can't occupy a tile of its own. The plugin consumes half-width characters **in pairs** and composes each pair into a single tile.

Because the same pairs recur constantly in normal text, composed tiles are kept in a **cache** occupying a reserved range of VRAM tiles. When a pair is already cached, drawing it costs nothing but a tilemap write. When it isn't, a new tile is composed — and if the reserved range is full, the least recently used pair is evicted to make room.

Text that ends mid-pair (end of string, newline, font switch) is padded with a half-width space.

### The reserved tile range

The plugin needs a block of background tile indices it can own. Scene background tilesets occupy tiles from 0 upward (up to 191) and GB Studio's UI frame, cursor and dialogue tiles occupy 192–255, so the default reserved range is **128–191**. That is safe for scenes whose tileset uses fewer than 128 unique tiles; adjust per scene with *Set Tile Range* when it isn't.

### Tile placement on Game Boy Color

On CGB, each tilemap cell can read its tile data from either VRAM bank, and the plugin sets that per character cell:

- **Bank 0 only** — the default, and the only mode on DMG hardware.
- **Bank 1 only (Color)** — every pair tile lives in bank 1, so the reserved indices stop competing with bank-0 scene tiles entirely.
- **Alternate bank 0/1 (Color)** — entries are spread across both banks, so the same index range holds **twice** as many pairs.

The two Color modes are meant for Color Only projects, and also work in mixed color modes on GBC hardware. On DMG the plugin falls back to *Bank 0 only* automatically. In Color Only mode your scene backgrounds may themselves use bank-1 tiles, so pick a range whose bank-1 indices are free too.

---

## Project Setup

### 1. Install the plugin and the font

Copy `src/HalfWidthTextPlugin` into your project's `plugins/` folder, and `font/halfwidth.png` + `font/halfwidth.json` into `assets/fonts/`. That is the original poketcg half-width font; you can also make your own (see below).

### 2. Set the font before drawing

The plugin renders glyphs from the **current** font, so use the stock **Set Font** event (or a `\002` in-text switch) to select the half-width font before any half-width draw.

### 3. Reset the cache in every scene

Add **Half-Width Text: Reset Tile Cache** to each scene's **On Init**. Loading a scene overwrites VRAM, and a stale cache would map text onto whatever tiles landed there.

### 4. Draw

Use the draw events for instant text, typed-out text, or a full dialogue box.

### Making a half-width font

A half-width font is a normal GB Studio font asset (`assets/fonts/name.png` + `name.json`) with three rules:

1. **Each glyph occupies only the left 4 pixels of its 8×8 tile** — the renderer packs two glyphs per tile from the left nibble.
2. **Use a non-transparent white background** — RGB (240,240,240) works. Pure white (255,255,255) counts as *transparent*, which makes the font compiler trim and left-shift the glyphs and destroys your spacing.
3. Map characters with the JSON **`table`** field when the image layout isn't plain ASCII order: `"table": { "é": 69 }` maps `é` to glyph 69, counting tile positions left-to-right, top-to-bottom. See `font/halfwidth.json` for a working example that maps accented characters onto their base glyphs.

Fonts laid out as 96 tiles (rows of 16, starting at space) get an automatic ASCII mapping — the `table` is only needed for extras.

---

## Engine Settings

Found under **Settings → Half-Width Text**.

| Setting | Default | Description |
|---|---|---|
| **First VRAM tile reserved for half-width text** | 128 | First background tile index reserved for pair tiles. |
| **Last VRAM tile reserved for half-width text** | 191 | Last reserved tile index, inclusive. |
| **Tile placement (VRAM bank)** | Bank 0 only | Which VRAM tile data bank pair tiles are uploaded to: Bank 0 only, Bank 1 only (Color), or Alternate bank 0/1 (Color). |
| **Pair cache capacity (entries)** | 64 | Pair-cache capacity, 4–128 entries. Each entry costs 4 bytes of WRAM, so lowering it reclaims WRAM. Raising it only helps together with a larger reserved tile range. |

Usable cache entries are `min(cache capacity, range size)` — or `min(cache capacity, 2 × range size)` with *Alternate bank 0/1*.

---

## Size Limits and Restrictions

- **The reserved range must not collide** with your scene background tiles (0 upward) or GB Studio's UI/dialogue tiles (192–255).
- **The cache can overflow.** When it is full, the least recently used pair's tile is reused, so text drawn long ago can visually corrupt if it is still on screen while a lot of new text is drawn. Size the range for the amount of distinct text you keep on screen at once.
- **Reset the cache on every scene load** — there is no automatic hook for it.
- **Switching fonts resets the pair cache.** Tiles already on screen keep their pixels until their slot is reused.
- Half-width text always renders **black-on-white, left-to-right**, like poketcg. The `\007` text colour and `\010` direction control codes are skipped; on CGB the current text palette and overlay priority are applied to the drawn tiles.
- Coordinates are tilemap coordinates (0–31). On scrolling scenes the background layer wraps within the 32×32 map, like the stock text renderer.
- Compatible variants are included for use alongside **ContinuousScenePlugin** and **ScreenScrollPlugin**, and are selected automatically.

### Supported control codes

The stock control-code set is handled: `\001` text speed, `\002` font switch (temporary within the text, like stock), `\003`/`\004` gotoxy and relative gotoxy in tile coordinates, `\005` escape, `\006` wait-for-input, `\013` CGB palette, `\n` newline, `\r` newline-with-scroll. GB Studio variables (`$Variable$`) are resolved before rendering.

---

## Events Reference

All events appear under the **Half-Width Text** group in the script editor.

| Event | Description |
|---|---|
| **Half-Width Text: Draw To Background** | Instantly draws text at an X/Y tile position on the background layer. |
| **Half-Width Text: Draw To Overlay** | The same, on the overlay (window) layer. |
| **Half-Width Text: Draw At Text Speed** | Types the text out at the current text speed on the background or overlay. A/B fast-forwards. Blocks until done; actors keep updating. |
| **Half-Width Text: Display Dialogue** | A full dialogue box like the stock *Display Dialogue*: the overlay slides in, text types out at text speed, scrolls past its scroll height, and closes on button press / when finished / never (non-modal). 40 characters per line. |
| **Half-Width Text: Reset Tile Cache** | Forgets all cached pair tiles. Call this in each scene's On Init. |
| **Half-Width Text: Set Tile Range** | Changes the reserved VRAM tile range and tile placement at runtime, and resets the cache. |

---

## Media

Two example projects are included:

- `halfWidthTextPluginExample/` — instant draws (including JSON-table accents), a typed-out line, and a scrolling half-width dialogue box, in mono mode.
- `halfWidthTextPluginColorExample/` — a Color Only build demonstrating tile placement: drawing with *Bank 1 only*, then switching to *Alternate bank 0/1* for the typed-out text and the dialogue.

---

## Memory Footprint

Measured against the stock GB Studio **4.3.0-e1** engine (per-file SDCC compile with GB Studio's build flags, default engine settings). Values are the plugin's *delta* versus the stock engine; DMG build, with CGB noted where it differs. ROM cost lands in banked ROM (GB Studio's autobanker spreads it across switchable banks); using the plugin's events additionally compiles a few bytes of GBVM script per call into your project's script banks.

| | Cost |
|---|---|
| WRAM | +324 bytes |
| ROM | +2,158 bytes (DMG) / +2,257 bytes (CGB) |

- **WRAM:** 324 bytes for the pair-tile cache tables. Scales with the **Pair cache capacity** engine setting at 4 bytes per entry (default 64 entries; e.g. 32 entries saves 128 bytes).
- **Engine WRAM headroom:** the stock GB Studio 4.3.0 engine leaves about **854 bytes** of WRAM free (usable engine WRAM is 7,776 bytes at 0xC0A0–0xDF00; the stock engine uses 6,922 bytes). With this plugin installed roughly **530 bytes** remain. This figure does not depend on how many global variables your project defines: the script memory array has a fixed size of VM_HEAP_SIZE + (VM_MAX_CONTEXTS × VM_CONTEXT_STACK_SIZE) words — 768 + 16 × 64 = 1,792 words (3,584 bytes) with stock engine settings.
- **SRAM:** not used.

---

<!-- BANK0:BEGIN -->
## Bank 0 (HOME) Usage

Bank 0 is the 16 KB non-switchable ROM bank that the GB Studio engine core,
the interrupt handlers and the GBDK runtime all share. Banked ROM is cheap
(add another bank), bank 0 is not, so it is usually the first thing a project
runs out of.

| | Bytes |
|---|---|
| Bank 0 used by this plugin | **0** |
| Bank 0 free with this plugin installed | **1,451** of 16,384 (91% used) |

**This plugin costs nothing in bank 0.** All of its code lives in a switchable
ROM bank; nothing it adds is resident in bank 0.

<details><summary>How this was measured</summary>

GB Studio 4.3.2, DMG target, default engine settings. Each module's bank 0
contribution is the `A _HOME size` record that SDCC writes into its `.rel`
object, summed over the engine sources this plugin provides. Stock sizes come
from building projects whose only plugin ships no engine C, so every module in
them is the untouched engine; two such builds were compared and agreed on all
73 shared modules.

The "free" figure is a stock project with this plugin and nothing else. Your
own number will differ: other plugins, and any engine settings that change what
the core compiles, move it independently of this plugin.

</details>
<!-- BANK0:END -->
