export interface RasterImageCrop {
  left: number
  top: number
  width: number
  height: number
}

function isBackgroundPixel(r: number, g: number, b: number, a: number, threshold = 245) {
  return a < 8 || (r >= threshold && g >= threshold && b >= threshold)
}

export function detectRasterImageCrop(
  imageData: ImageData,
  threshold = 245
): RasterImageCrop | null {
  const { width, height, data } = imageData
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let found = false

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (isBackgroundPixel(data[index], data[index + 1], data[index + 2], data[index + 3], threshold)) {
        continue
      }
      found = true
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (!found) return null

  let right = maxX
  const contentWidth = maxX - minX + 1
  const contentHeight = maxY - minY + 1

  // Matplotlib exports often include a colorbar on the right edge.
  if (contentWidth > contentHeight * 1.05) {
    const colorbarStart = minX + Math.round(contentWidth * 0.82)
    let colorbarPixels = 0
    let totalPixels = 0
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = colorbarStart; x <= maxX; x += 1) {
        totalPixels += 1
        const index = (y * width + x) * 4
        if (
          !isBackgroundPixel(
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3],
            threshold
          )
        ) {
          colorbarPixels += 1
        }
      }
    }
    if (totalPixels > 0 && colorbarPixels / totalPixels > 0.08) {
      right = Math.max(minX, colorbarStart - 2)
    }
  }

  return {
    left: minX,
    top: minY,
    width: right - minX + 1,
    height: maxY - minY + 1,
  }
}

export function prepareHarvestRasterCanvas(
  image: HTMLImageElement,
  options: { threshold?: number; makeBackgroundTransparent?: boolean } = {}
) {
  const threshold = options.threshold ?? 245
  const makeBackgroundTransparent = options.makeBackgroundTransparent ?? true

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = image.naturalWidth
  sourceCanvas.height = image.naturalHeight
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) return sourceCanvas

  sourceCtx.drawImage(image, 0, 0)
  const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const crop = detectRasterImageCrop(sourceData, threshold)

  const output = document.createElement('canvas')
  if (!crop) {
    output.width = sourceCanvas.width
    output.height = sourceCanvas.height
    const outputCtx = output.getContext('2d')
    if (!outputCtx) return output
    outputCtx.drawImage(sourceCanvas, 0, 0)
    return output
  }

  output.width = crop.width
  output.height = crop.height
  const outputCtx = output.getContext('2d', { willReadFrequently: true })
  if (!outputCtx) return output

  const cropped = sourceCtx.getImageData(crop.left, crop.top, crop.width, crop.height)
  if (makeBackgroundTransparent) {
    for (let index = 0; index < cropped.data.length; index += 4) {
      if (
        isBackgroundPixel(
          cropped.data[index],
          cropped.data[index + 1],
          cropped.data[index + 2],
          cropped.data[index + 3],
          threshold
        )
      ) {
        cropped.data[index + 3] = 0
      }
    }
  }
  outputCtx.putImageData(cropped, 0, 0)
  return output
}
