import { useState, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Pose } from './types'

// MediaPose landmark indices for skeleton bones
export const POSE_CONNECTIONS: [number, number][] = [
  // torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // left arm
  [11, 13], [13, 15],
  // right arm
  [12, 14], [14, 16],
  // left leg
  [23, 25], [25, 27],
  // right leg
  [24, 26], [26, 28],
  // head
  [0, 11], [0, 12],
]

let landmarkerInstance: PoseLandmarker | null = null

async function getLandmarker(): Promise<PoseLandmarker> {
  if (landmarkerInstance) return landmarkerInstance

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
  )
  landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    numPoses: 4,
  })
  return landmarkerInstance
}

export function usePoseEstimation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const estimatePoses = useCallback(async (imageEl: HTMLImageElement): Promise<Pose[]> => {
    setLoading(true)
    setError(null)
    try {
      const landmarker = await getLandmarker()
      const result = landmarker.detect(imageEl)
      console.log('[pose2img] landmarks:', result.landmarks.length, 'worldLandmarks:', result.worldLandmarks.length)

      // Use normalized landmarks (always populated) centered and scaled for Three.js.
      // worldLandmarks (meters, y-up) are better for 3D but aren't always returned.
      return result.landmarks.map((lm, i) => {
        const world = result.worldLandmarks[i]
        if (world && world.length > 0) {
          return { landmarks: world.map(pt => ({ ...pt, y: -pt.y })) }
        }
        // Convert normalized [0,1] coords to centered [-0.5,0.5], flip y for Three.js
        return {
          landmarks: lm.map(pt => ({
            x: pt.x - 0.5,
            y: -(pt.y - 0.5),
            z: pt.z,
            visibility: pt.visibility,
          })),
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pose estimation failed'
      setError(msg)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return { estimatePoses, loading, error }
}
