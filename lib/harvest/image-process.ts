export interface RasterImageCrop {
  left: number
  top: number
  width: number
  height: number
}

export interface PreparedHarvestRaster {
  canvas: HTMLCanvasElement
  crop: RasterImageCrop | null
  sourceWidth: number
  sourceHeight: number
}

function isWhiteBackgroundPixel(r: number, g: number, b: number, a: number, threshold = 245) {
  return a < 8 || (r >= threshold && g >= threshold && b >= threshold)
}

function isMatplotlibFramePixel(r: number, g: number, b: number, a: number) {
  if (a < 8) return true
  if (isWhiteBackgroundPixel(r, g, b, a)) return true

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  if (luminance < 28) return true

  const maxChannel = Math.max(r, g, b)
  const minChannel = Math.min(r, g, b)
  if (maxChannel < 45 && maxChannel - minChannel < 18) return true

  return false
}

export function isRasterTransparentPixel(r: number, g: number, b: number, a: number) {
  return isWhiteBackgroundPixel(r, g, b, a)
}

function isRasterCropBackgroundPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  options: { includeDarkFrame?: boolean }
) {
  if (isWhiteBackgroundPixel(r, g, b, a)) return true
  if (options.includeDarkFrame) return isMatplotlibFramePixel(r, g, b, a)
  return false
}

function isEdgeCropBackgroundPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  options: { includeDarkFrame?: boolean }
) {
  if (isRasterCropBackgroundPixel(r, g, b, a, options)) return true
  if (options.includeDarkFrame) return false

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  const maxChannel = Math.max(r, g, b)
  const minChannel = Math.min(r, g, b)
  return maxChannel < 45 && maxChannel - minChannel < 18 && luminance < 28
}

function isMatplotlibDarkPixel(r: number, g: number, b: number, a: number) {
  if (a < 8) return true
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance < 42 && Math.max(r, g, b) < 72
}

function trimMatplotlibPlot(imageData: ImageData): RasterImageCrop | null {
  const { width, height, data } = imageData
  const darkRatio = (y: number, xStart: number, xEnd: number) => {
    let dark = 0
    const total = xEnd - xStart + 1
    for (let x = xStart; x <= xEnd; x += 1) {
      const index = (y * width + x) * 4
      if (isMatplotlibDarkPixel(data[index], data[index + 1], data[index + 2], data[index + 3])) {
        dark += 1
      }
    }
    return dark / total
  }

  const columnDarkRatio = (x: number, yStart: number, yEnd: number) => {
    let dark = 0
    const total = yEnd - yStart + 1
    for (let y = yStart; y <= yEnd; y += 1) {
      const index = (y * width + x) * 4
      if (isMatplotlibDarkPixel(data[index], data[index + 1], data[index + 2], data[index + 3])) {
        dark += 1
      }
    }
    return dark / total
  }

  let top = 0
  let bottom = height - 1
  let left = 0
  let right = width - 1

  while (top < bottom && darkRatio(top, left, right) > 0.86) top += 1
  while (bottom > top && darkRatio(bottom, left, right) > 0.86) bottom -= 1
  while (left < right && columnDarkRatio(left, top, bottom) > 0.86) left += 1
  while (right > left && columnDarkRatio(right, top, bottom) > 0.86) right -= 1

  if (top >= bottom || left >= right) return null
  if (top === 0 && left === 0 && right === width - 1 && bottom === height - 1) return null

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  }
}

function trimUniformEdgeMargins(
  imageData: ImageData,
  options: { includeDarkFrame?: boolean }
): RasterImageCrop | null {
  const { width, height, data } = imageData
  const isBackgroundAt = (x: number, y: number) => {
    const index = (y * width + x) * 4
    return isEdgeCropBackgroundPixel(
      data[index],
      data[index + 1],
      data[index + 2],
      data[index + 3],
      options
    )
  }

  let top = 0
  let bottom = height - 1
  let left = 0
  let right = width - 1

  while (top < bottom && Array.from({ length: width }, (_, x) => isBackgroundAt(x, top)).every(Boolean)) {
    top += 1
  }
  while (bottom > top && Array.from({ length: width }, (_, x) => isBackgroundAt(x, bottom)).every(Boolean)) {
    bottom -= 1
  }
  while (left < right && Array.from({ length: height }, (_, y) => isBackgroundAt(left, y)).every(Boolean)) {
    left += 1
  }
  while (right > left && Array.from({ length: height }, (_, y) => isBackgroundAt(right, y)).every(Boolean)) {
    right -= 1
  }

  if (top >= bottom || left >= right) return null
  if (top === 0 && left === 0 && right === width - 1 && bottom === height - 1) return null

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  }
}

/** Remove matplotlib frame, colorbar, and internal padding; keep only plot pixels. */
export function detectHarvestPlotCrop(imageData: ImageData): RasterImageCrop | null {
  const contentCrop = detectRasterImageCrop(imageData, { includeDarkFrame: false })
  if (contentCrop) return contentCrop
  return trimMatplotlibPlot(imageData)
}

export function detectRasterImageCrop(
  imageData: ImageData,
  options: { includeDarkFrame?: boolean } = {}
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
        isRasterCropBackgroundPixel(
          data[index],
          data[index + 1],
          data[index + 2],
          data[index + 3],
          options
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

  if (!found) {
    return trimUniformEdgeMargins(imageData, options)
  }

  if (!options.includeDarkFrame) {
    const edgeTrim = trimUniformEdgeMargins(imageData, options)
    if (edgeTrim) {
      const edgeArea = edgeTrim.width * edgeTrim.height
      const contentArea = (maxX - minX + 1) * (maxY - minY + 1)
      if (edgeArea < contentArea * 0.995) {
        return edgeTrim
      }
    }
  }

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
          !isRasterCropBackgroundPixel(
            data[index],
            data[index + 1],
            data[index + 2],
            data[index + 3],
            options
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

  const contentCrop = {
    left: minX,
    top: minY,
    width: right - minX + 1,
    height: maxY - minY + 1,
  }

  if (!options.includeDarkFrame) return contentCrop

  const edgeCrop = trimUniformEdgeMargins(imageData, options)
  if (!edgeCrop) return contentCrop

  const contentArea = contentCrop.width * contentCrop.height
  const edgeArea = edgeCrop.width * edgeCrop.height
  return edgeArea < contentArea ? edgeCrop : contentCrop
}

function makeUniformBorderTransparent(imageData: ImageData, crop: RasterImageCrop) {
  const { width, height, data } = imageData
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onBorder =
        x < crop.left ||
        y < crop.top ||
        x >= crop.left + crop.width ||
        y >= crop.top + crop.height
      if (!onBorder) continue
      const index = (y * width + x) * 4
      if (
        isEdgeCropBackgroundPixel(
          data[index],
          data[index + 1],
          data[index + 2],
          data[index + 3],
          { includeDarkFrame: false }
        )
      ) {
        data[index + 3] = 0
      }
    }
  }
  return imageData
}

function makeRasterBackgroundTransparent(imageData: ImageData, includeDarkFrame = false) {
  const { data } = imageData
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    const a = data[index + 3]
    const transparent =
      isRasterTransparentPixel(r, g, b, a) ||
      (includeDarkFrame && isMatplotlibFramePixel(r, g, b, a))
    if (transparent) {
      data[index + 3] = 0
    }
  }
  return imageData
}

export function prepareHarvestRasterCanvas(
  image: HTMLImageElement,
  options: { cropPlotFrame?: boolean; transparentBackground?: boolean } = {}
) {
  const isJpeg = /\.jpe?g($|\?)/i.test(image.src)
  const cropPlotFrame = options.cropPlotFrame ?? true
  const transparentBackground = options.transparentBackground ?? isJpeg

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = image.naturalWidth
  sourceCanvas.height = image.naturalHeight
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) {
    return {
      canvas: sourceCanvas,
      crop: null,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
    } satisfies PreparedHarvestRaster
  }

  sourceCtx.drawImage(image, 0, 0)
  let working = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  if (transparentBackground) {
    working = makeRasterBackgroundTransparent(working, isJpeg)
  }

  const output = document.createElement('canvas')
  const crop = cropPlotFrame
    ? isJpeg
      ? detectHarvestPlotCrop(working) || detectRasterImageCrop(working, { includeDarkFrame: true })
      : detectRasterImageCrop(working, { includeDarkFrame: false })
    : null

  if (!isJpeg && crop) {
    working = makeUniformBorderTransparent(working, crop)
  }

  if (!crop) {
    output.width = working.width
    output.height = working.height
    const outputCtx = output.getContext('2d')
    if (!outputCtx) {
      return {
        canvas: output,
        crop: null,
        sourceWidth: sourceCanvas.width,
        sourceHeight: sourceCanvas.height,
      } satisfies PreparedHarvestRaster
    }
    outputCtx.putImageData(working, 0, 0)
    return {
      canvas: output,
      crop: null,
      sourceWidth: sourceCanvas.width,
      sourceHeight: sourceCanvas.height,
    } satisfies PreparedHarvestRaster
  }

  output.width = crop.width
  output.height = crop.height
  const outputCtx = output.getContext('2d', { willReadFrequently: true })
  if (!outputCtx) {
    return {
      canvas: output,
      crop,
      sourceWidth: sourceCanvas.width,
      sourceHeight: sourceCanvas.height,
    } satisfies PreparedHarvestRaster
  }

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
  return {
    canvas: output,
    crop,
    sourceWidth: sourceCanvas.width,
    sourceHeight: sourceCanvas.height,
  } satisfies PreparedHarvestRaster
}
