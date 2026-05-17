import { useRef, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Line } from '@react-three/drei'
import type { Pose } from './types'
import { POSE_CONNECTIONS } from './usePoseEstimation'

const JOINT_RADIUS = 0.035
const JOINT_COLOR = '#ffffff'

// DWPose-style colors per connection group (matches POSE_CONNECTIONS order)
const CONNECTION_COLORS: string[] = [
  // torso
  '#00ff88', '#00ff88', '#00ff88', '#00ff88',
  // left arm
  '#00aaff', '#00aaff',
  // right arm
  '#ff6600', '#ff6600',
  // left leg
  '#aa44ff', '#aa44ff',
  // right leg
  '#ffdd00', '#ffdd00',
  // head
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
  poseImage: string  // base64 PNG — DWPose-style render, used directly as ControlNet input
}

interface CaptureHandleProps {
  captureRef: React.RefObject<{ capture: () => CaptureResult } | null>
}

function CaptureHandle({ captureRef }: CaptureHandleProps) {
  const { gl } = useThree()

  useImperativeHandle(captureRef, () => ({
    capture(): CaptureResult {
      return { poseImage: gl.domElement.toDataURL('image/png') }
    },
  }))

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
        gl={{ preserveDrawingBuffer: true }}
      >
        <OrbitControls makeDefault />
        {poses.map((pose, i) => (
          <Skeleton key={i} pose={pose} />
        ))}
        <CaptureHandle captureRef={captureRef} />
      </Canvas>
    )
  }
)

export default SkeletonScene
