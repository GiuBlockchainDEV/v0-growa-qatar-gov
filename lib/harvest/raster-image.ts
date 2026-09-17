export interface RasterImageDimensions {
  width: number
  height: number
  format: string | null
}

function readPngDimensions(buffer: Buffer): RasterImageDimensions | null {
  if (buffer.length < 24 || buffer[0] !== 0x89 || buffer[1] !== 0x50) return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    format: 'png',
  }
}

function readJpegDimensions(buffer: Buffer): RasterImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null

  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) break
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (length < 2) break

    if (marker === 0xc0 || marker === 0xc2) {
      const height = buffer.readUInt16BE(offset + 5)
      const width = buffer.readUInt16BE(offset + 7)
      if (width > 0 && height >  0) {
        return { width, height, format: 'jpeg' }
      }
      return null
    }

    offset += 2 + length
  }

  return null
}

export async function readRasterImageDimensions(
  buffer: Buffer
): Promise<RasterImageDimensions | null> {
  return readPngDimensions(buffer) || readJpegDimensions(buffer)
}
