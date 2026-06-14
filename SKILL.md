---
name: anim-blob-morph
description: "Organic SVG blob hero that morphs via time-noise and swells toward the cursor, with listening/thinking/speaking states (a breathing 'voice' visual). Use when building a hero or loading visual for AI / voice / music products, or any organic breathing accent. 時間ノイズで変形しカーソルに膨らむ有機的SVG blobヒーロー。AI・音声・音楽プロダクトのヒーローやロード中ステータスに使う。"
---

# anim-blob-morph (B·Lo · Blob Morphing)

Pure HTML + CSS + vanilla JS (SVG only, **zero dependencies**). A single SVG `<path>` blob continuously deformed by time-noise, swelling toward the cursor, with three synced states.

純粋な HTML + CSS + Vanilla JS（SVG のみ・**外部依存ゼロ**）。SVG 単一 `<path>` を時間ノイズで連続変形し、カーソル近接で膨らむ。3 状態に同期。

## When to use / 使いどころ
- **EN:** Hero / first-view for AI, voice, or music products; "loading"/"thinking" status; idle-time filler; any soft organic breathing accent.
- **JP:** AI／音声／音楽プロダクトのヒーロー、ロード中ステータス、空白時間のフィラー、有機的に呼吸する装飾。

## Bundled assets / 同梱アセット
This skill folder is the reference implementation — copy from these files:
- `index.html` — full working demo (open to preview)
- `style.css` — the `.sy-*` / `.synch` component block
- `script.js` — the self-contained IIFE (the blob engine)
- `README.md` — full human-facing doc (JP, with mechanism details)

## How to apply / 適用手順
1. **Copy 2 blocks / 2ブロックを移植:** the `/* ─── COMPONENT ─── */` block (`.sy-*` / `.synch`) from `style.css`, and the whole IIFE from `script.js`. No build step.
2. **Markup / マークアップ:**
   ```html
   <div class="synch" data-blob
        data-blob-points="12" data-blob-radius="120"
        data-blob-amp="22" data-blob-cursor="38">
     <div class="sy-blobs" data-blob-host>
       <svg class="sy-blob sy-blob--outer" viewBox="-200 -200 400 400">
         <defs><radialGradient id="g-outer">...</radialGradient></defs>
         <path data-blob-path data-blob-role="outer" fill="url(#g-outer)"/>
       </svg>
       <svg class="sy-blob sy-blob--inner" viewBox="-200 -200 400 400">
         <defs><radialGradient id="g-inner">...</radialGradient></defs>
         <path data-blob-path data-blob-role="inner" fill="url(#g-inner)"/>
       </svg>
     </div>
   </div>
   ```
3. **State API / 状態API:** the root element exposes `_blob`:
   ```js
   const root = document.querySelector('[data-blob]');
   root._blob.setState('thinking'); // 'listening' | 'thinking' | 'speaking'
   root._blob.beat();               // one-shot outward swell (~330ms decay)
   ```

## Customizable attributes / カスタマイズ属性
| attribute | role | default | range |
|---|---|---|---|
| `data-blob-points` | control points (more = smoother) / 制御点数 | `12` | 4–32 |
| `data-blob-radius` | base radius (viewBox units) / 基準半径 | `120` | 50–200 |
| `data-blob-amp` | max per-point displacement / 揺らぎ幅 | `22` | 0–100 |
| `data-blob-cursor` | cursor attraction range / カーソル追従範囲 | `38` | 0–200 |

Examples / 調整例: angular blob → `points="7" amp="34"`; cursor-sensitive → `cursor="80"`; calm only → `amp="10" cursor="0"`.

## Accessibility & constraints / アクセシビリティと制約
- Respects `prefers-reduced-motion: reduce` (stops `requestAnimationFrame`, holds the first static shape). SVG is `aria-hidden` (decorative).
- Cursor tracking reads only `data-blob-host` pointer events. `beat()` spam caps at +16 baseR (no runaway growth).
- Both outer/inner layers share one `setState` (same rhythm). For independent behavior, use separate instances.

> Full mechanism (Catmull-Rom → cubic Bézier, state model table) is in `README.md`.
