import { useState, useCallback } from 'react'
import type { SkeletonSceneHandle } from './SkeletonScene'

interface GeneratePanelProps {
  sceneRef: React.RefObject<SkeletonSceneHandle | null>
  photoSrc: string | null
}

export default function GeneratePanel({ sceneRef, photoSrc }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    if (!sceneRef.current || !prompt.trim()) return
    setLoading(true)
    setError(null)

    try {
      const { poseImage, depthMap } = sceneRef.current.capture()

      const body: Record<string, unknown> = {
        depth_map: depthMap.split(',')[1],
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
      setResult(`data:image/png;base64,${data.image}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [sceneRef, prompt])

  return (
    <div className="w-72 shrink-0 border-l border-slate-800 flex flex-col">
      <div className="p-3 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
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

        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}
      </div>

      {result && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-3 border-t border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
            Result
          </div>
          <img src={result} className="w-full object-contain" alt="generated" />
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
