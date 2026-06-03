export interface QatarWeatherGridCell {
  id: string
  latitude: number
  longitude: number
  gridSizeM: number
  row: number
  col: number
}

const GRID_SIZE_M = 5000
const QATAR_REFERENCE_LATITUDE = 25.35
const QATAR_MIN_LAT = 24.45
const QATAR_MAX_LAT = 26.25
const QATAR_MIN_LON = 50.7
const QATAR_MAX_LON = 51.7
const QATAR_CELL_COUNT = 510

const QATAR_BOUNDARY: Array<[number, number]> = [
  [50.75, 24.55],
  [50.85, 24.7],
  [50.78, 24.92],
  [50.74, 25.16],
  [50.8, 25.38],
  [50.95, 25.68],
  [51.12, 25.88],
  [51.27, 26.15],
  [51.43, 26.18],
  [51.61, 25.95],
  [51.64, 25.6],
  [51.58, 25.35],
  [51.55, 25.12],
  [51.44, 24.88],
  [51.28, 24.7],
  [51.05, 24.58],
]

function degreesPerMeterLatitude() {
  return 1 / 111_320
}

function degreesPerMeterLongitude(latitude: number) {
  return 1 / (111_320 * Math.cos((latitude * Math.PI) / 180))
}

function isInsidePolygon(longitude: number, latitude: number) {
  let inside = false
  let previousIndex = QATAR_BOUNDARY.length - 1

  for (let index = 0; index < QATAR_BOUNDARY.length; index += 1) {
    const [currentLon, currentLat] = QATAR_BOUNDARY[index]
    const [previousLon, previousLat] = QATAR_BOUNDARY[previousIndex]
    const crossesLatitude = currentLat > latitude !== previousLat > latitude
    const intersectionLon =
      ((previousLon - currentLon) * (latitude - currentLat)) / (previousLat - currentLat) + currentLon

    if (crossesLatitude && longitude < intersectionLon) {
      inside = !inside
    }

    previousIndex = index
  }

  return inside
}

function distanceToSegment(
  longitude: number,
  latitude: number,
  start: [number, number],
  end: [number, number]
) {
  const [startLon, startLat] = start
  const [endLon, endLat] = end
  const deltaLon = endLon - startLon
  const deltaLat = endLat - startLat
  const lengthSquared = deltaLon * deltaLon + deltaLat * deltaLat

  if (lengthSquared === 0) {
    return Math.hypot(longitude - startLon, latitude - startLat)
  }

  const segmentPosition = Math.max(
    0,
    Math.min(1, ((longitude - startLon) * deltaLon + (latitude - startLat) * deltaLat) / lengthSquared)
  )
  const projectedLon = startLon + segmentPosition * deltaLon
  const projectedLat = startLat + segmentPosition * deltaLat

  return Math.hypot(longitude - projectedLon, latitude - projectedLat)
}

function distanceToBoundary(longitude: number, latitude: number) {
  return QATAR_BOUNDARY.reduce((minimum, point, index) => {
    const nextPoint = QATAR_BOUNDARY[(index + 1) % QATAR_BOUNDARY.length]
    return Math.min(minimum, distanceToSegment(longitude, latitude, point, nextPoint))
  }, Number.POSITIVE_INFINITY)
}

export function generateQatarWeatherGrid(): QatarWeatherGridCell[] {
  const latStep = GRID_SIZE_M * degreesPerMeterLatitude()
  const lonStep = GRID_SIZE_M * degreesPerMeterLongitude(QATAR_REFERENCE_LATITUDE)
  const boundaryBufferDegrees = 0.041
  const cells: QatarWeatherGridCell[] = []

  let row = 0
  for (let latitude = QATAR_MIN_LAT; latitude <= QATAR_MAX_LAT; latitude += latStep) {
    let col = 0
    for (let longitude = QATAR_MIN_LON; longitude <= QATAR_MAX_LON; longitude += lonStep) {
      if (isInsidePolygon(longitude, latitude) || distanceToBoundary(longitude, latitude) <= boundaryBufferDegrees) {
        cells.push({
          id: `W5_${String(cells.length + 1).padStart(3, '0')}`,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          gridSizeM: GRID_SIZE_M,
          row,
          col,
        })
      }
      col += 1
    }
    row += 1
  }

  return cells.slice(0, QATAR_CELL_COUNT)
}

export const QATAR_WEATHER_GRID_CELL_COUNT = QATAR_CELL_COUNT
