import { useRef, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Line } from '@react-three/drei'
import * as THREE from 'three'
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

export interface CaptureResult {
  poseImage: string   // base64 PNG — current skeleton render
  depthMap: string    // base64 PNG — depth map (lighter = closer)
}

interface CaptureHandleProps {
  captureRef: React.RefObject<{ capture: () => CaptureResult } | null>
}

function CaptureHandle({ captureRef }: CaptureHandleProps) {
  const { gl, scene, camera } = useThree()

  useImperativeHandle(captureRef, () => ({
    capture(): CaptureResult {
      // 1. Pose image = current render
      const poseImage = gl.domElement.toDataURL('image/png')

      // 2. Depth map — swap all meshes to MeshDepthMaterial, render, invert
      const depthMat = new THREE.MeshDepthMaterial()
      const savedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
      const savedBg = scene.background

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          savedMaterials.set(obj, obj.material)
          obj.material = depthMat
        }
      })
      scene.background = new THREE.Color(0x000000)
      gl.render(scene, camera)
      const rawDepth = gl.domElement.toDataURL('image/png')

      // Restore
      savedMaterials.forEach((mat, obj) => { obj.material = mat })
      scene.background = savedBg
      gl.render(scene, camera)

      // Invert depth so near=light, far=dark (ControlNet convention)
      const depthMap = invertImage(rawDepth)
      return { poseImage, depthMap }
    },
  }))

  return null
}

function invertImage(dataUrl: string): string {
  const img = new Image()
  img.src = dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = img.width || 512
  canvas.height = img.height || 512
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255 - imageData.data[i]
    imageData.data[i + 1] = 255 - imageData.data[i + 1]
    imageData.data[i + 2] = 255 - imageData.data[i + 2]
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
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
        style={{ background: '#1a1a2e' }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 2]} intensity={1} />
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
