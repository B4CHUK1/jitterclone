// src/components/Canvas/CanvasElement.jsx
import { useRef, useEffect } from 'react'
import { Image, Transformer } from 'react-konva'
import useImage from 'use-image'
import useSceneStore from '../../store/sceneStore'

// Compute Konva crop props to emulate object-fit: cover
// Source: Konva official "Scale Image To Fit" pattern
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

export default function CanvasElement({ element, isSelected, onSelect }) {
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

  // Attach Transformer to the image node imperatively — the only reliable way
  // in react-konva. Declarative attachment causes timing issues.
  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  // Crop props based on fit mode
  const cropProps = {}
  if (image && fit === 'cover') {
    cropProps.crop = getCoverCrop(image, width, height)
  }

  // Commit drag position to store
  const handleDragEnd = (e) => {
    updateProperties(id, {
      x: e.target.x(),
      y: e.target.y(),
    })
  }

  // CRITICAL: Konva Transformer mutates scaleX/scaleY on the node, NOT width/height.
  // We must bake the scale into absolute dimensions and reset scale to 1,
  // otherwise subsequent transforms compound incorrectly.
  const handleTransformEnd = () => {
    const node = imageRef.current
    const newScaleX = node.scaleX()
    const newScaleY = node.scaleY()

    const newWidth  = Math.max(20, node.width()  * newScaleX)
    const newHeight = Math.max(20, node.height() * newScaleY)

    // Reset scale on the Konva node immediately
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
        onTransformEnd={handleTransformEnd}
        perfectDrawEnabled={false}
        {...cropProps}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          anchorSize={8}
          anchorCornerRadius={0}
          anchorStroke="#e8ff00"
          anchorFill="#0a0a0a"
          anchorStrokeWidth={1}
          borderStroke="#e8ff00"
          borderStrokeWidth={1}
          rotateAnchorOffset={24}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={8}
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
