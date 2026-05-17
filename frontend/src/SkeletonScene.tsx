import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sphere, Line } from '@react-three/drei'
import type { Pose } from './types'
import { POSE_CONNECTIONS } from './usePoseEstimation'

const JOINT_RADIUS = 0.03
const JOINT_COLOR = '#60a5fa'
const BONE_COLOR = '#94a3b8'

function Skeleton({ pose }: { pose: Pose }) {
  const lm = pose.landmarks
  return (
    <group>
      {lm.map((pt, i) => (
        <Sphere key={i} args={[JOINT_RADIUS, 8, 8]} position={[pt.x, pt.y, pt.z]}>
          <meshStandardMaterial color={JOINT_COLOR} />
        </Sphere>
      ))}
      {POSE_CONNECTIONS.map(([a, b], i) => {
        if (!lm[a] || !lm[b]) return null
        const start: [number, number, number] = [lm[a].x, lm[a].y, lm[a].z]
        const end: [number, number, number] = [lm[b].x, lm[b].y, lm[b].z]
        return <Line key={i} points={[start, end]} color={BONE_COLOR} lineWidth={2} />
      })}
    </group>
  )
}

interface SkeletonSceneProps {
  poses: Pose[]
}

export default function SkeletonScene({ poses }: SkeletonSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  return (
    <Canvas
      ref={canvasRef}
      camera={{ position: [0, 0, 3], fov: 50 }}
      style={{ background: '#1a1a2e' }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 4, 2]} intensity={1} />
      <OrbitControls makeDefault />
      {poses.map((pose, i) => (
        <Skeleton key={i} pose={pose} />
      ))}
    </Canvas>
  )
}
