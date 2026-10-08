/**
 * Renders the shareable story cards to a canvas. Cards are always dark,
 * whatever the page theme, and sized for a phone story (9:16).
 */
import { imageUrl } from '../api'
import type { Ranked } from './aggregate'
import { fmtDuration, fmtInt, initials, plural } from './format'
import type { StoryData } from './story'

export const STORY_W = 1080
export const STORY_H = 1920

export type StoryKind = 'artist' | 'song' | 'albums' | 'months'

export const STORY_KINDS: { id: StoryKind; label: string }[] = [
  { id: 'artist', label: 'Top artist' },
  { id: 'song', label: 'Top song' },
  { id: 'albums', label: 'Top albums' },
  { id: 'months', label: 'Month by month' },
]

const W = STORY_W
const H = STORY_H
const PAD = 84
const FOOT = H - 96
const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`

const INK = { page: '#0d0d0d', text: '#ffffff', secondary: '#c3c2b7', muted: '#898781', surface: '#2a2a28' }
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#1baf7a']

const ACCENTS: Record<StoryKind, [string, string]> = {
  artist: ['#3987e5', '#9085e9'],
  song: ['#d55181', '#d95926'],
  albums: ['#199e70', '#3987e5'],
  months: ['#c98500', '#d55181'],
}

type Ctx = CanvasRenderingContext2D
type Img = HTMLImageElement | null

// ---------- assets ----------

const images = new Map<string, Promise<Img>>()

function loadImage(src: string | undefined): Promise<Img> {
  if (!src) return Promise.resolve(null)
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

const art = (item: Ranked | undefined, size: number) => loadImage(imageUrl(item?.image, size))

/** Draw a story card onto `canvas`. Images load first, so painting never interleaves with another draw. */
export async function drawStory(canvas: HTMLCanvasElement, kind: StoryKind, d: StoryData, signal?: AbortSignal) {
  const logo = loadImage('/favicon.svg')
  let paint: (ctx: Ctx, logo: Img) => void
  if (kind === 'artist' || kind === 'song') {
    const items = kind === 'artist' ? d.artists : d.songs
    const [hero, thumbs] = await Promise.all([art(items[0], 640), Promise.all(items.map((i) => art(i, 160)))])
    paint = (ctx, l) => paintHero(ctx, l, d, kind, hero, thumbs)
  } else if (kind === 'albums') {
    const thumbs = await Promise.all(d.albums.map((a) => art(a, 300)))
    paint = (ctx, l) => paintAlbums(ctx, l, d, thumbs)
  } else {
    const thumbs = await Promise.all(d.months.map((m) => art(m.top, 160)))
    paint = (ctx, l) => paintMonths(ctx, l, d, thumbs)
  }
  const logoImg = await logo
  if (signal?.aborted) return
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  paint(ctx, logoImg)
}

// ---------- text helpers ----------

function ellipsize(ctx: Ctx, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(text.slice(0, mid) + '…').width <= max) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo).trimEnd() + '…'
}

/** Word-wrap into at most `maxLines`, ellipsizing the last. `fits` is false if anything was cut. */
function wrap(ctx: Ctx, text: string, max: number, maxLines: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(next).width <= max) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  const kept = lines.length > maxLines ? [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')] : lines
  const out = kept.map((l) => ellipsize(ctx, l, max))
  return { lines: out, fits: lines.length <= maxLines && out.every((l, i) => l === kept[i]) }
}

/** The largest font size (stepping down from `max`) at which `text` fits in `maxLines`. Leaves ctx.font set. */
function fit(ctx: Ctx, text: string, weight: number, max: number, min: number, width: number, maxLines: number) {
  for (let size = max; size > min; size -= 4) {
    ctx.font = font(weight, size)
    const w = wrap(ctx, text, width, maxLines)
    if (w.fits) return { size, lines: w.lines }
  }
  ctx.font = font(weight, min)
  return { size: min, lines: wrap(ctx, text, width, maxLines).lines }
}

function text(ctx: Ctx, s: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = 'left') {
  ctx.font = f
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(s, x, y)
}

function eyebrow(ctx: Ctx, s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.save()
  ctx.letterSpacing = '4px'
  text(ctx, s.toUpperCase(), x, y, font(700, 30), color, align)
  ctx.restore()
}

// ---------- drawing helpers ----------

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function glow(ctx: Ctx, color: string, x: number, y: number, r: number, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function background(ctx: Ctx, [a, b]: [string, string], img: Img) {
  ctx.fillStyle = INK.page
  ctx.fillRect(0, 0, W, H)
  if (img) {
    // Shrink then stretch the artwork for a soft wash of its colours.
    const tiny = document.createElement('canvas')
    tiny.width = tiny.height = 10
    tiny.getContext('2d')!.drawImage(img, 0, 0, 10, 10)
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.filter = 'blur(60px)'
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(tiny, (W - H * 1.2) / 2, -H * 0.1, H * 1.2, H * 1.2)
    ctx.restore()
  }
  glow(ctx, a, W * 0.05, H * 0.08, 1100, img ? 0.35 : 0.5)
  glow(ctx, b, W * 1.0, H * 0.55, 1000, img ? 0.25 : 0.4)
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, rgba(INK.page, 0.45))
  shade.addColorStop(0.4, rgba(INK.page, 0.6))
  shade.addColorStop(1, rgba(INK.page, 0.92))
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)
}

function chrome(ctx: Ctx, logo: Img, d: StoryData) {
  ctx.textBaseline = 'middle'
  if (logo) ctx.drawImage(logo, PAD, 96, 56, 56)
  text(ctx, 'Plex Rewind', PAD + (logo ? 76 : 0), 124, font(700, 36), INK.text)
  text(ctx, d.label, W - PAD, 124, font(700, 36), INK.text, 'right')
  text(ctx, d.user, PAD, FOOT, font(500, 28), INK.secondary)
  text(ctx, d.dates, W - PAD, FOOT, font(500, 28), INK.muted, 'right')
  ctx.textBaseline = 'alphabetic'
}

function drawArt(ctx: Ctx, img: Img, label: string, x: number, y: number, size: number, round: boolean, shadow = false) {
  const path = new Path2D()
  if (round) path.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  else path.roundRect(x, y, size, size, Math.max(8, size * 0.05))
  if (shadow) {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = size * 0.12
    ctx.shadowOffsetY = size * 0.04
    ctx.fillStyle = INK.surface
    ctx.fill(path)
    ctx.restore()
  }
  ctx.save()
  ctx.clip(path)
  if (img) {
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, x, y, size, size)
  } else {
    ctx.fillStyle = INK.surface
    ctx.fillRect(x, y, size, size)
    ctx.textBaseline = 'middle'
    text(ctx, initials(label), x + size / 2, y + size / 2, font(700, size * 0.34), INK.muted, 'center')
    ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()
}

// ---------- cards ----------

/** Top artist / top song: big #1 artwork and name, then the top 5. */
function paintHero(ctx: Ctx, logo: Img, d: StoryData, kind: 'artist' | 'song', hero: Img, thumbs: Img[]) {
  const items = kind === 'artist' ? d.artists : d.songs
  const round = kind === 'artist'
  const [accent] = ACCENTS[kind]
  background(ctx, ACCENTS[kind], hero)
  chrome(ctx, logo, d)

  const top = items[0]
  if (!top) return

  // Top-5 list, anchored above the footer.
  const ROW = 108
  const listTop = FOOT - 70 - items.length * ROW
  eyebrow(ctx, kind === 'artist' ? 'Top 5 artists' : 'Top 5 songs', PAD, listTop - 24, INK.muted)
  items.forEach((item, i) => {
    const y = listTop + i * ROW
    const mid = y + ROW / 2
    ctx.textBaseline = 'middle'
    text(ctx, String(i + 1), PAD + 18, mid, font(800, 36), i === 0 ? accent : INK.muted, 'center')
    drawArt(ctx, thumbs[i], item.label, PAD + 56, mid - 40, 80, round)
    const x = PAD + 164
    const countW = 170
    ctx.font = font(650, 38)
    text(ctx, ellipsize(ctx, item.label, W - PAD - x - countW), x, mid - 19, ctx.font, INK.text)
    const sub = kind === 'artist' ? plural(item.children, 'song') : item.sub ?? ''
    ctx.font = font(450, 28)
    text(ctx, ellipsize(ctx, sub, W - PAD - x - countW), x, mid + 23, ctx.font, INK.muted)
    text(ctx, fmtInt(item.plays), W - PAD, mid - 10, font(700, 36), INK.text, 'right')
    text(ctx, item.plays === 1 ? 'play' : 'plays', W - PAD, mid + 26, font(450, 24), INK.muted, 'right')
    ctx.textBaseline = 'alphabetic'
  })

  // Hero: eyebrow, artwork, name, stats. Artwork takes whatever height is left.
  const width = W - PAD * 2
  const name = fit(ctx, top.label, 800, 116, 60, width, 2)
  const nameFont = ctx.font
  const lineH = name.size * 1.04
  const subLine = kind === 'song' ? top.sub : undefined
  const statLine = [plural(top.plays, 'play'), fmtDuration(top.seconds), kind === 'artist' ? plural(top.children, 'song') : null]
    .filter(Boolean)
    .join('  ·  ')

  // Centre artwork + text between the eyebrow and the list.
  const textH = 48 + name.lines.length * lineH + (subLine ? 58 : 0) + 56
  const regionTop = 290
  const region = listTop - 100 - regionTop
  const artSize = Math.max(280, Math.min(600, region - textH))
  let y = regionTop + Math.max(0, (region - artSize - textH) / 2)
  eyebrow(ctx, kind === 'artist' ? 'Your top artist' : 'Your top song', W / 2, 236, accent, 'center')
  drawArt(ctx, hero, top.label, (W - artSize) / 2, y, artSize, round, true)

  y += artSize + 48
  ctx.textBaseline = 'top'
  for (const line of name.lines) {
    text(ctx, line, W / 2, y, nameFont, INK.text, 'center')
    y += lineH
  }
  if (subLine) {
    ctx.font = font(600, 42)
    text(ctx, ellipsize(ctx, subLine, width), W / 2, y + 6, ctx.font, INK.secondary, 'center')
    y += 58
  }
  text(ctx, statLine, W / 2, y + 14, font(500, 32), INK.muted, 'center')
  ctx.textBaseline = 'alphabetic'
}

/** Top 5 albums, one per artist. */
function paintAlbums(ctx: Ctx, logo: Img, d: StoryData, thumbs: Img[]) {
  const [accent] = ACCENTS.albums
  background(ctx, ACCENTS.albums, thumbs[0])
  chrome(ctx, logo, d)

  eyebrow(ctx, 'Your top albums', PAD, 260, accent)
  text(ctx, 'On repeat', PAD, 362, font(800, 100), INK.text)
  text(ctx, 'One album per artist', PAD, 424, font(500, 32), INK.muted)

  const top = 490
  const rowH = Math.min(270, (FOOT - 80 - top) / Math.max(1, d.albums.length))
  const size = rowH - 40
  d.albums.forEach((a, i) => {
    const y = top + i * rowH
    drawArt(ctx, thumbs[i], a.label, PAD, y, size, false, true)
    const x = PAD + size + 44
    const width = W - PAD - x
    const title = fit(ctx, a.label, 750, 50, 38, width, 2)
    const titleFont = ctx.font
    const lh = title.size * 1.12
    let ty = y + (size - (44 + title.lines.length * lh + 50 + 36)) / 2
    ctx.textBaseline = 'top'
    text(ctx, `#${i + 1}`, x, ty, font(800, 30), accent)
    ty += 44
    for (const line of title.lines) {
      text(ctx, line, x, ty, titleFont, INK.text)
      ty += lh
    }
    ctx.font = font(550, 34)
    text(ctx, ellipsize(ctx, a.sub ?? '', width), x, ty + 6, ctx.font, INK.secondary)
    text(ctx, `${plural(a.plays, 'play')}  ·  ${fmtDuration(a.seconds)}`, x, ty + 54, font(450, 28), INK.muted)
    ctx.textBaseline = 'alphabetic'
  })
}

/** Which artist topped each month, as a bar per month coloured by artist. */
function paintMonths(ctx: Ctx, logo: Img, d: StoryData, thumbs: Img[]) {
  const [accent] = ACCENTS.months
  background(ctx, ACCENTS.months, null)
  chrome(ctx, logo, d)

  // Most months on top, for the headline.
  const wins = new Map<string, { item: Ranked; n: number }>()
  for (const { top } of d.months) {
    if (!top) continue
    const w = wins.get(top.key) ?? { item: top, n: 0 }
    w.n++
    wins.set(top.key, w)
  }
  const leader = [...wins.values()].sort((a, b) => b.n - a.n || b.item.plays - a.item.plays)[0]
  const colors = new Map([...wins.keys()].map((k, i) => [k, SERIES[i % SERIES.length]]))

  eyebrow(ctx, 'Month by month', PAD, 260, accent)
  const headline = fit(ctx, 'Who ruled each month', 800, 96, 56, W - PAD * 2, 1)
  const headFont = ctx.font
  let y = 260 + 24
  for (const line of headline.lines) {
    y += headline.size * 1.05
    text(ctx, line, PAD, y - headline.size * 0.2, headFont, INK.text)
  }
  if (leader) {
    ctx.font = font(500, 32)
    const months = d.months.filter((m) => m.top).length
    const msg = leader.n > 1 ? `${leader.item.label} took ${leader.n} of ${months} months` : `${wins.size} different artists on top`
    text(ctx, ellipsize(ctx, msg, W - PAD * 2), PAD, y + 34, ctx.font, INK.muted)
  }

  const top = y + 100
  const rowH = Math.min(150, (FOOT - 70 - top) / d.months.length)
  const artSize = Math.min(84, rowH - 22)
  const max = Math.max(1, ...d.months.map((m) => m.top?.plays ?? 0))
  const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })
  const nameX = PAD + 100 + artSize + 28
  const barMax = W - PAD - nameX - 170

  ctx.textBaseline = 'middle'
  d.months.forEach(({ month, top: item }, i) => {
    const mid = top + i * rowH + rowH / 2
    ctx.save()
    ctx.letterSpacing = '2px'
    text(ctx, monthFmt.format(month).toUpperCase(), PAD, mid, font(700, 28), INK.muted)
    ctx.restore()
    if (!item) {
      text(ctx, 'Nothing played', PAD + 100, mid, font(500, 32), INK.muted)
      return
    }
    const color = colors.get(item.key)!
    drawArt(ctx, thumbs[i], item.label, PAD + 100, mid - artSize / 2, artSize, true)
    ctx.font = font(700, Math.min(38, rowH * 0.32))
    text(ctx, ellipsize(ctx, item.label, W - PAD - nameX), nameX, mid - rowH * 0.14, ctx.font, INK.text)
    const barH = Math.max(8, Math.min(14, rowH * 0.1))
    const barY = mid + rowH * 0.16
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(nameX, barY - barH / 2, Math.max(barH, (item.plays / max) * barMax), barH, barH / 2)
    ctx.fill()
    text(ctx, plural(item.plays, 'play'), W - PAD, barY, font(600, 28), INK.secondary, 'right')
  })
  ctx.textBaseline = 'alphabetic'
}
