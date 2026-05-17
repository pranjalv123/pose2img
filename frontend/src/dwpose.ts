import * as THREE from 'three'

// 17 connections between the 18 OpenPose body keypoints
export const OP_CONNECTIONS: [number, number][] = [
  [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7],
  [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13],
  [1, 0], [0, 14], [14, 16], [0, 15], [15, 17],
]

// Standard DWPose body palette: 18 colors evenly spaced around the hue wheel
export const OP_COLORS: string[] = [
  '#ff0000', '#ff5500', '#ffaa00', '#ffff00',
  '#aaff00', '#55ff00', '#00ff00', '#00ff55',
  '#00ffaa', '#00ffff', '#00aaff', '#0055ff',
  '#0000ff', '#5500ff', '#aa00ff', '#ff00ff',
  '#ff00aa', '#ff0055',
]

// OpenPose keypoint index → MediaPipe landmark index (null = computed from neighbors)
const OP_TO_MP: (number | null)[] = [
  0,    // 0  nose
  null, // 1  neck  (midpoint of MP 11 + MP 12)
  12,   // 2  right shoulder
  14,   // 3  right elbow
  16,   // 4  right wrist
  11,   // 5  left shoulder
  13,   // 6  left elbow
  15,   // 7  left wrist
  24,   // 8  right hip
  26,   // 9  right knee
  28,   // 10 right ankle
  23,   // 11 left hip
  25,   // 12 left knee
  27,   // 13 left ankle
  5,    // 14 right eye
  2,    // 15 left eye
  8,    // 16 right ear
  7,    // 17 left ear
]

type Landmark = { x: number; y: number; z: number; visibility?: number }
type Pt = { x: number; y: number } | null

const SIZE = 1024
const MIN_VIS = 0.3

export function renderDWPose(poses: Landmark[][], camera: THREE.Camera): string {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SIZE, SIZE)

  const tmp = new THREE.Vector3()

  for (const lms of poses) {
    // Project every MediaPipe landmark through the current camera into canvas space
    const proj: Pt[] = lms.map(lm => {
      if ((lm.visibility ?? 1) < MIN_VIS) return null
      tmp.set(lm.x, lm.y, lm.z).project(camera)
      if (tmp.z > 1) return null  // behind the camera
      return {
        x: (tmp.x + 1) / 2 * SIZE,
        y: (1 - (tmp.y + 1) / 2) * SIZE,
      }
    })

    // Build the 18 OpenPose keypoints from the projected MediaPipe set
    const op: Pt[] = OP_TO_MP.map((mpIdx, opIdx) => {
      if (opIdx === 1) {
        // Neck = midpoint of left shoulder (MP 11) and right shoulder (MP 12)
        const l = proj[11], r = proj[12]
        return l && r ? { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 } : null
      }
      return mpIdx !== null ? (proj[mpIdx] ?? null) : null
    })

    // Draw limb sticks
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    OP_CONNECTIONS.forEach(([a, b], i) => {
      const pa = op[a], pb = op[b]
      if (!pa || !pb) return
      ctx.strokeStyle = OP_COLORS[i]
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    })

    // Draw keypoint dots on top of sticks
    op.forEach((pt, i) => {
      if (!pt) return
      ctx.fillStyle = OP_COLORS[i % OP_COLORS.length]
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  return canvas.toDataURL('image/png')
}
