import { useEffect, useMemo, useRef, useState } from 'react'
import type { Play } from '../api'
import { buildStory, type StoryData } from '../lib/story'
import { drawStory, STORY_H, STORY_KINDS, STORY_W, type StoryKind } from '../lib/storyDraw'

// Clipboard images and file sharing need a secure context (HTTPS or localhost).
const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
const canShare = (() => {
  try {
    return !!navigator.canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
})()

export function StoryDialog({
  plays,
  range,
  user,
  onClose,
}: {
  plays: Play[]
  range: { after: string; before: string }
  user: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const data = useMemo(() => buildStory(plays, range, user), [plays, range, user])

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="story-dialog"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
    >
      <div className="card-head">
        <div>
          <h2>Share your {data.label}</h2>
          <p className="sub">
            Story-sized images, ready to post.
            {!canCopy && ' Copying needs HTTPS or localhost, so use Save here.'}
          </p>
        </div>
        <button className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="story-grid">
        {STORY_KINDS.map((k) => (
          <StoryCard key={k.id} data={data} kind={k.id} label={k.label} />
        ))}
      </div>
    </dialog>
  )
}

function StoryCard({ data, kind, label }: { data: StoryData; kind: StoryKind; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    const ctl = new AbortController()
    const canvas = canvasRef.current!
    drawStory(canvas, kind, data, ctl.signal)
      .then(() => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')))
      .then((b) => !ctl.signal.aborted && setBlob(b))
    return () => ctl.abort()
  }, [data, kind])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(t)
  }, [flash])

  const filename = `plex-rewind-${data.year}-${kind}.png`

  const copy = async () => {
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setFlash('Copied')
    } catch {
      setFlash("Couldn't copy")
    }
  }

  const save = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const share = async () => {
    if (!blob) return
    try {
      await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })] })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setFlash("Couldn't share")
    }
  }

  return (
    <figure className="story-card">
      <canvas ref={canvasRef} width={STORY_W} height={STORY_H} className={blob ? 'ready' : ''} aria-label={`${label} story card`} />
      <figcaption>
        <span className="story-label">{flash ?? label}</span>
        <span className="story-actions">
          {canCopy && (
            <button onClick={copy} disabled={!blob}>
              Copy
            </button>
          )}
          <button onClick={save} disabled={!blob}>
            Save
          </button>
          {canShare && (
            <button onClick={share} disabled={!blob}>
              Share
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
