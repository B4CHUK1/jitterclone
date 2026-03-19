// src/components/Canvas/CanvasElement.jsx
import { useRef, useEffect } from 'react'
import { Image, Transformer } from 'react-konva'
import useImage from 'use-image'
import useSceneStore from '../../store/sceneStore'

function getCoverCrop(image, width, height) {
  const imgRatio = image.width / image.height
  const boxRatio = width / height
  let cropW, cropH, cropX, cropY

  if (imgRatio > boxRatio) {
    cropH = image.height
    cropW = image.height * boxRatio
    cropX = (image.width - cropW) / 2
    cropY = 0
  } else {
    cropW = image.width
    cropH = image.width / boxRatio
    cropX = 0
    cropY = (image.height - cropH) / 2
  }

  return { x: cropX, y: cropY, width: cropW, height: cropH }
}

export default function CanvasElement({ element, isSelected, onSelect, onRegisterRef }) {
  const imageRef = useRef(null)
  const trRef = useRef(null)
  const updateProperties = useSceneStore((s) => s.updateProperties)

  const { id, src, fit = 'contain', properties } = element
  const x        = properties.x.value
  const y        = properties.y.value
  const width    = properties.width.value
  const height   = properties.height.value
  const rotation = properties.rotation.value
  const opacity  = properties.opacity.value
  const scaleX   = properties.scaleX.value
  const scaleY   = properties.scaleY.value

  const [image] = useImage(src)

  // Register the Konva image node with Canvas so it can drive the rotation overlay
  useEffect(() => {
    if (imageRef.current) {
      onRegisterRef?.(id, imageRef.current)
    }
    return () => onRegisterRef?.(id, null)
  }, [id, onRegisterRef])

  // Attach Transformer to image node imperatively
  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  // Live cover crop during transform — no setState, pure Konva imperative
  const handleTransform = () => {
    const node = imageRef.current
    if (!image || fit !== 'cover') return

    const currentWidth  = node.width()  * node.scaleX()
    const currentHeight = node.height() * node.scaleY()

    const imgRatio = image.width / image.height
    const boxRatio = currentWidth / currentHeight
    let cropX, cropY, cropW, cropH

    if (imgRatio > boxRatio) {
      cropH = image.height
      cropW = image.height * boxRatio
      cropX = (image.width - cropW) / 2
      cropY = 0
    } else {
      cropW = image.width
      cropH = image.width / boxRatio
      cropX = 0
      cropY = (image.height - cropH) / 2
    }

    node.crop({ x: cropX, y: cropY, width: cropW, height: cropH })
    node.getLayer()?.batchDraw()
  }

  // Crop props for initial / React-driven render
  const cropProps = {}
  if (image && fit === 'cover') {
    cropProps.crop = getCoverCrop(image, width, height)
  }

  const handleDragEnd = (e) => {
    updateProperties(id, { x: e.target.x(), y: e.target.y() })
  }

  // CRITICAL: bake scaleX/scaleY → width/height, reset scale to 1
  const handleTransformEnd = () => {
    const node = imageRef.current
    const sx = node.scaleX()
    const sy = node.scaleY()
    const newWidth  = Math.max(20, node.width()  * sx)
    const newHeight = Math.max(20, node.height() * sy)

    node.scaleX(1)
    node.scaleY(1)

    updateProperties(id, {
      x:        node.x(),
      y:        node.y(),
      width:    newWidth,
      height:   newHeight,
      rotation: node.rotation(),
      scaleX:   1,
      scaleY:   1,
    })
  }

  return (
    <>
      <Image
        ref={imageRef}
        image={image}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        opacity={opacity}
        scaleX={scaleX}
        scaleY={scaleY}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransform={handleTransform}
        onTransformEnd={handleTransformEnd}
        perfectDrawEnabled={false}
        {...cropProps}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          // Wide invisible hit area on each anchor — makes entire edge draggable
          anchorHitStrokeWidth={10}
          // Custom per-anchor styling: corners visible, edges invisible
          anchorStyleFunc={(anchor) => {
            const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
            const isCorner = CORNERS.some((name) => anchor.hasName(name))

            if (isCorner) {
              anchor.width(8)
              anchor.height(8)
              anchor.offsetX(4)
              anchor.offsetY(4)
              anchor.fill('#0a0a0a')
              anchor.stroke('#e8ff00')
              anchor.strokeWidth(1)
              anchor.cornerRadius(0)
            } else if (anchor.hasName('rotater')) {
              // Rotation handled by HTML overlay — hide Konva's built-in handle
              anchor.width(0)
              anchor.height(0)
              anchor.fill('transparent')
              anchor.stroke('transparent')
            } else {
              // Edge anchors (top-center, bottom-center, middle-left, middle-right)
              // Visually invisible; hit area set by anchorHitStrokeWidth
              anchor.width(0)
              anchor.height(0)
              anchor.fill('transparent')
              anchor.stroke('transparent')
            }
          }}
          borderStroke="#e8ff00"
          borderStrokeWidth={1}
          // Rotation handled by overlay — disable Konva's built-in rotation
          rotateEnabled={false}
          keepRatio={false}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}
