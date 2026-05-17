import { useCallback, useRef } from 'react'

interface PhotoUploadProps {
  onImage: (img: HTMLImageElement, src: string) => void
}

export default function PhotoUpload({ onImage }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // Draw through a canvas to bake in EXIF rotation before passing to MediaPipe
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      const correctedUrl = canvas.toDataURL('image/jpeg')
      const corrected = new Image()
      corrected.onload = () => onImage(corrected, correctedUrl)
      corrected.src = correctedUrl
    }
    img.src = url
  }, [onImage])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }, [handleFile])

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 transition-colors"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <div className="text-5xl">📷</div>
      <div className="text-center">
        <p className="text-slate-300 font-medium">Drop a photo or click to upload</p>
        <p className="text-slate-500 text-sm mt-1">Poses will be detected automatically</p>
      </div>
    </div>
  )
}
