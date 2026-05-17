import { useRef, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Line } from '@react-three/drei'
import type { Pose } from './types'
import { POSE_CONNECTIONS } from './usePoseEstimation'
import { renderDWPose } from './dwpose'

const JOINT_RADIUS = 0.035
const JOINT_COLOR = '#ffffff'

// Colors for the interactive 3D viewport — purely visual, not sent to the model
const CONNECTION_COLORS: string[] = [
  '#00ff88', '#00ff88', '#00ff88', '#00ff88',
  '#00aaff', '#00aaff',
  '#ff6600', '#ff6600',
  '#aa44ff', '#aa44ff',
  '#ffdd00', '#ffdd00',
  '#ffffff', '#ffffff',
]

function Skeleton({ pose }: { pose: Pose }) {
  const lm = pose.landmarks
  return (
    <group>
      {lm.map((pt, i) => (
        <Sphere key={i} args={[JOINT_RADIUS, 10, 10]} position={[pt.x, pt.y, pt.z]}>
          <meshBasicMaterial color={JOINT_COLOR} />
        </Sphere>
      ))}
      {POSE_CONNECTIONS.map(([a, b], i) => {
        if (!lm[a] || !lm[b]) return null
        const start: [number, number, number] = [lm[a].x, lm[a].y, lm[a].z]
        const end: [number, number, number] = [lm[b].x, lm[b].y, lm[b].z]
        return (
          <Line
            key={i}
            points={[start, end]}
            color={CONNECTION_COLORS[i] ?? '#ffffff'}
            lineWidth={3}
          />
        )
      })}
    </group>
  )
}

export interface CaptureResult {
  poseImage: string  // base64 PNG — DWPose 2D projection at current camera angle
}

interface CaptureHandleProps {
  captureRef: React.RefObject<{ capture: () => CaptureResult } | null>
  poses: Pose[]
}

function CaptureHandle({ captureRef, poses }: CaptureHandleProps) {
  const { camera } = useThree()

  useImperativeHandle(captureRef, () => ({
    capture(): CaptureResult {
      return { poseImage: renderDWPose(poses.map(p => p.landmarks), camera) }
    },
  }), [camera, poses])

  return null
}

export interface SkeletonSceneHandle {
  capture: () => CaptureResult
}

interface SkeletonSceneProps {
  poses: Pose[]
}

const SkeletonScene = forwardRef<SkeletonSceneHandle, SkeletonSceneProps>(
  function SkeletonScene({ poses }, ref) {
    const captureRef = useRef<{ capture: () => CaptureResult } | null>(null)

    useImperativeHandle(ref, () => ({
      capture: () => captureRef.current!.capture(),
    }))

    return (
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ background: '#000000' }}
      >
        <OrbitControls makeDefault />
        {poses.map((pose, i) => (
          <Skeleton key={i} pose={pose} />
        ))}
        <CaptureHandle captureRef={captureRef} poses={poses} />
      </Canvas>
    )
  }
)

export default SkeletonScene
