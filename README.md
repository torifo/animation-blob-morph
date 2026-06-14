# B·Lo · ブロブモーフィング

> SVG path を時間ノイズで連続変形させ、カーソル近接で形が膨らむ有機的なヒーロー。架空会話 AI **SYNCH** の listening / thinking / speaking という 3 状態に同期して呼吸する blob を組み込んだ実用デモ。

**Live demo**: `./index.html`

## 概要

| 項目 | 内容 |
|---|---|
| ジャンル | B · 流体 |
| 用途 | Lo · ローディング／ヒーロー |
| 主な参考 | Cuberto, Codrops |
| 依存 | なし（Pure HTML + CSS + Vanilla JS、SVG のみ） |
| 推奨配置 | AI／音声／音楽プロダクトのヒーロー、ロード中ステータス、空白時間のフィラー |

## スキルとして導入 / Install as a skill

このリポジトリは Claude Code / Codex CLI 共通の **`SKILL.md`**（オープン標準）を同梱しており、AI エージェントのスキルとして使えます。リポジトリ自体をスキルディレクトリへリンクするだけです。

This repo ships a cross-agent **`SKILL.md`** (open standard) usable by both Claude Code and Codex CLI. Just link the repo into the agent's skills directory.

```bash
# Claude Code
ln -s "$(pwd)" ~/.claude/skills/anim-blob-morph
# Codex CLI
ln -s "$(pwd)" ~/.codex/skills/anim-blob-morph
```

エージェントを再起動すると `description` に基づき自動でマッチします（スキル名: `anim-blob-morph`）。
Restart the agent; it is matched automatically by the skill's `description` (skill name: `anim-blob-morph`).

## 仕組み

各 blob は SVG の単一 `<path>`。N 個の制御点 (`data-blob-points`、既定 12) を円周上に配置し、毎フレーム以下で更新する：

```
r_i  = baseR * modeExpand + noise(i, t*speed) * amp * modeAmp + beat * 16
a_i  = (i / N) * 2π + noise(i+100, t*speed*0.8) * 0.08
(x,y) = r_i * (cos(a_i), sin(a_i))

if cursor 近接（dist < cursorRadius）:
  (x,y) += unit(cursor - p) * cursorRadius * 0.42 * (1 - dist/cursorRadius)²
```

その N 点を **Catmull-Rom → 3 次ベジェ** に変換して closed path にする。outer / inner の 2 レイヤーは異なる位相（`Math.random()` で初期化）と速度倍率で同じパイプを通る。CSS の `mix-blend-mode: screen` とグラデーション + blur で奥行きを作る。

### 状態モデル

| 状態 | amp 倍率 | speed 倍率 | base radius | hue / drop-shadow |
|---|---|---|---|---|
| `listening` | 1.0 | 1.0 | 1.0 | hi (magenta) |
| `thinking` | 1.55 | 2.4 | 0.96 | alt (blue) shifted |
| `speaking` | 1.28 | 1.7 | 1.07 | hi で強発光 + inner 拡大 |

`speaking` 突入時に `beat()` を呼ぶと baseR に +16 の一発膨張が乗り、~330ms で減衰する（鼓動）。

## 組み込み手順

### 1. 2 ファイルをコピー

`style.css` の `/* ─── COMPONENT ─── */` ブロック（`.sy-*` / `.synch`）と、`script.js` の IIFE 全体を移植先へ。外部依存ゼロ。

### 2. マークアップ

```html
<div class="synch"
     data-blob
     data-blob-points="12"
     data-blob-radius="120"
     data-blob-amp="22"
     data-blob-cursor="38">

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

### 3. API

ルート要素には `_blob` が生える：

```js
const root = document.querySelector('[data-blob]');
root._blob.setState('thinking');   // 'listening' | 'thinking' | 'speaking'
root._blob.beat();                  // 外向きへ一発膨張
```

## カスタマイズ可能な属性

| データ属性 | 役割 | デフォルト | 範囲 |
|---|---|---|---|
| `data-blob-points` | 制御点の数（多いほど滑らか） | `12` | 4〜32 |
| `data-blob-radius` | 基準半径（viewBox 単位） | `120` | 50〜200 |
| `data-blob-amp` | 各点の最大変位（揺らぎ） | `22` | 0〜100 |
| `data-blob-cursor` | カーソル近接で点が引き寄せられる範囲 | `38` | 0〜200 |

### よくある調整例

```html
<!-- 角ばった blob（点を減らしてカクッと） -->
<div class="synch" data-blob data-blob-points="7" data-blob-amp="34"> ... </div>

<!-- カーソルに敏感に追従 -->
<div class="synch" data-blob data-blob-cursor="80"> ... </div>

<!-- 穏やかに揺らぐだけ -->
<div class="synch" data-blob data-blob-amp="10" data-blob-cursor="0"> ... </div>
```

## アクセシビリティ

- `prefers-reduced-motion: reduce` 時は `requestAnimationFrame` を停止し、最初に描画された静止形のまま固定（CSS の rotate / pulse 等も無効化）。
- SVG は装飾扱いで `aria-hidden`。会話パネルは「ライブプレビュー」表示のため `aria-live` は付けず、SKIP ボタンでユーザーが能動的に循環操作できる。
- カーソル追従はホスト要素 (`data-blob-host`) の pointer event だけ拾い、外側で動かしても影響しない。

## 制約 / 既知の挙動

- カーソル座標は host の getBoundingClientRect を毎回読むため、レイアウト変動時も追従する（ただしスクロールイベント直後の 1 フレーム遅延あり）。
- 2 レイヤーの outer / inner は独立位相だが、共通の `setState` を共有する（同じリズムで揺らぐ）。レイヤーごとに異なる挙動が欲しい場合は分けたインスタンスにする。
- `beat()` を高頻度で連打すると重なって最大 baseR の +16 で頭打ち（連打しても無限に膨張しない）。

## 変更履歴

- **v0.1** — 初版。12 点 Catmull-Rom blob × 2 レイヤー、listening/thinking/speaking 状態切替、SYNCH 会話パネル（4 ターン 6s 循環）。

## ライセンス

ANIMATION DESIGN STUDY の一部として公開（コピペ自由）。
