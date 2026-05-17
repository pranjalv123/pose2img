import { useState, useCallback } from 'react'
import PhotoUpload from './PhotoUpload'
import SkeletonScene from './SkeletonScene'
import { usePoseEstimation } from './usePoseEstimation'
import type { Pose } from './types'

type Stage = 'upload' | 'scene'

export default function App() {
  const [stage, setStage] = useState<Stage>('upload')
  const [photoSrc, setPhotoSrc] = useState<string | null>(null)
  const [poses, setPoses] = useState<Pose[]>([])
  const { estimatePoses, loading, error } = usePoseEstimation()

  const handleImage = useCallback(async (img: HTMLImageElement, src: string) => {
    setPhotoSrc(src)
    const detected = await estimatePoses(img)
    setPoses(detected)
    if (detected.length > 0) {
      setStage('scene')
    }
    // stay on upload stage if 0 detections — error or "no poses" will show
  }, [estimatePoses])

  const reset = () => {
    setStage('upload')
    setPhotoSrc(null)
    setPoses([])
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-slate-200">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">pose2img</h1>
        <span className="text-slate-600 text-sm">pose reference → generated image</span>
        {stage === 'scene' && (
          <button
            onClick={reset}
            className="ml-auto text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← new photo
          </button>
        )}
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {stage === 'upload' && (
          <div className="flex-1 p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400">Detecting poses…</p>
              </div>
            ) : (
              <PhotoUpload onImage={handleImage} />
            )}
            {error && (
              <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
            )}
            {!loading && !error && photoSrc && poses.length === 0 && (
              <p className="mt-3 text-yellow-500 text-sm text-center">No poses detected — try a photo with a clearly visible person</p>
            )}
          </div>
        )}

        {stage === 'scene' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: reference photo */}
            <div className="w-72 shrink-0 border-r border-slate-800 flex flex-col">
              <div className="p-3 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                Reference photo
              </div>
              {photoSrc && (
                <img
                  src={photoSrc}
                  className="w-full object-contain"
                  alt="reference"
                />
              )}
              <div className="p-3 border-t border-slate-800 mt-auto">
                <p className="text-xs text-slate-500">
                  {poses.length} pose{poses.length !== 1 ? 's' : ''} detected
                </p>
              </div>
            </div>

            {/* Center: 3D skeleton viewport */}
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider flex items-center gap-3">
                3D skeleton
                <span className="text-slate-600 normal-case">drag to orbit · scroll to zoom</span>
              </div>
              <div className="flex-1">
                <SkeletonScene poses={poses} />
              </div>
            </div>

            {/* Right: generation panel (placeholder) */}
            <div className="w-72 shrink-0 border-l border-slate-800 flex flex-col">
              <div className="p-3 border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                Generate
              </div>
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-slate-600 text-sm text-center">
                  Generation panel coming soon
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
