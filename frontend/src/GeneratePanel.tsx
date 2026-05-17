import { useState, useCallback, useEffect, useRef } from 'react'
import type { SkeletonSceneHandle } from './SkeletonScene'

interface GeneratePanelProps {
  sceneRef: React.RefObject<SkeletonSceneHandle | null>
  photoSrc: string | null
}

// Typical cold-start + inference time in seconds (used to animate the bar)
const EXPECTED_DURATION = 60

export default function GeneratePanel({ sceneRef, photoSrc }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!loading) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      startTimeRef.current = null
      return
    }

    startTimeRef.current = performance.now()

    const tick = () => {
      const secs = (performance.now() - startTimeRef.current!) / 1000
      setElapsed(Math.round(secs))
      // Ease toward 95% asymptotically so bar never reaches 100 until done
      setProgress(95 * (1 - Math.exp(-secs / EXPECTED_DURATION)))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [loading])

  const generate = useCallback(async () => {
    if (!sceneRef.current || !prompt.trim()) return
    setLoading(true)
    setProgress(0)
    setElapsed(0)
    setError(null)

    try {
      const { poseImage } = sceneRef.current.capture()

      const body: Record<string, unknown> = {
        pose_image: poseImage.split(',')[1],
        prompt: prompt.trim(),
      }
      if (photoSrc) {
        body.reference_image = photoSrc.split(',')[1]
      }

      const resp = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail ?? 'Generation failed')
      }

      const data = await resp.json()
      setProgress(100)
      setResult(`data:image/png;base64,${data.image}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [sceneRef, prompt])

  return (
    <div className="w-72 shrink-0 border-l border-slate-800 flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider sticky top-0 bg-[#0f0f0f] z-10">
        Generate
      </div>

      <div className="flex flex-col gap-3 p-3">
        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500 transition-colors"
          rows={4}
          placeholder="Describe the scene or character…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>

        {loading && (
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-slate-500 text-xs">{elapsed}s elapsed</p>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}
      </div>

      {result && (
        <div className="flex flex-col border-t border-slate-800">
          <div className="p-3 text-xs text-slate-500 uppercase tracking-wider">
            Result
          </div>
          <img src={result} className="w-full" alt="generated" />
          <div className="p-3">
            <a
              href={result}
              download="pose2img.png"
              className="block w-full text-center py-1.5 rounded border border-slate-700 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
