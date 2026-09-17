export interface RasterImageCrop {
  left: number
  top: number
  width: number
  height: number
}

function isWhiteBackgroundPixel(r: number, g: number, b: number, a: number, threshold = 245) {
  return a < 8 || (r >= threshold && g >= threshold && b >= threshold)
}

export function isRasterTransparentPixel(r: number, g: number, b: number, a: number) {
  if (a < 8) return true
  if (isWhiteBackgroundPixel(r, g, b, a)) return true

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  if (luminance < 28) return true

  const maxChannel = Math.max(r, g, b)
  const minChannel = Math.min(r, g, b)
  if (maxChannel < 45 && maxChannel - minChannel < 18) return true

  return false
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
      if (
        isRasterTransparentPixel(
          data[index],
          data[index + 1],
          data[index + 2],
          data[index + 3]
        )
      ) {
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

  if (contentWidth > contentHeight * 1.05) {
    const colorbarStart = minX + Math.round(contentWidth * 0.82)
    let colorbarPixels = 0
    let totalPixels = 0
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = colorbarStart; x <= maxX; x += 1) {
        totalPixels += 1
        const index = (y * width + x) * 4
        if (
          !isRasterTransparentPixel(
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3]
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

function makeRasterBackgroundTransparent(imageData: ImageData) {
  const { data } = imageData
  for (let index = 0; index < data.length; index += 4) {
    if (
      isRasterTransparentPixel(
        data[index],
        data[index + 1],
        data[index + 2],
        data[index + 3]
      )
    ) {
      data[index + 3] = 0
    }
  }
  return imageData
}

export function prepareHarvestRasterCanvas(
  image: HTMLImageElement,
  options: { cropPlotFrame?: boolean } = {}
) {
  const cropPlotFrame = options.cropPlotFrame ?? /\.jpe?g($|\?)/i.test(image.src)

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = image.naturalWidth
  sourceCanvas.height = image.naturalHeight
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) return sourceCanvas

  sourceCtx.drawImage(image, 0, 0)
  let working = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  working = makeRasterBackgroundTransparent(working)

  const output = document.createElement('canvas')
  const crop = cropPlotFrame ? detectRasterImageCrop(working) : null

  if (!crop) {
    output.width = working.width
    output.height = working.height
    const outputCtx = output.getContext('2d')
    if (!outputCtx) return output
    outputCtx.putImageData(working, 0, 0)
    return output
  }

  output.width = crop.width
  output.height = crop.height
  const outputCtx = output.getContext('2d', { willReadFrequently: true })
  if (!outputCtx) return output

  const cropped = sourceCtx.createImageData(crop.width, crop.height)
  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const sourceIndex = ((crop.top + y) * working.width + (crop.left + x)) * 4
      const targetIndex = (y * crop.width + x) * 4
      cropped.data[targetIndex] = working.data[sourceIndex]
      cropped.data[targetIndex + 1] = working.data[sourceIndex + 1]
      cropped.data[targetIndex + 2] = working.data[sourceIndex + 2]
      cropped.data[targetIndex + 3] = working.data[sourceIndex + 3]
    }
  }

  outputCtx.putImageData(cropped, 0, 0)
  return output
}
