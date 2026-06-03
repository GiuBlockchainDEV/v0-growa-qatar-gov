import { NextResponse } from 'next/server'
import { generateQatarWeatherGrid, QATAR_WEATHER_GRID_CELL_COUNT } from '@/lib/weather/qatar-grid'
import {
  fetchWeatherByCoordinates,
  getWeatherApiKey,
  missingWeatherApiKeyPayload,
  parseRequestedAt,
} from '../_shared'

function parseInteger(input: string | null, fallback: number, min: number, max: number) {
  const value = input ? Number(input) : fallback
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

async function runInBatches<T, R>(items: T[], batchSize: number, worker: (item: T) => Promise<R>) {
  const output: R[] = []
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    output.push(...(await Promise.all(batch.map((item) => worker(item)))))
  }
  return output
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedAt = parseRequestedAt(searchParams.get('requested_at') || searchParams.get('requestedAt'))

  if (requestedAt === 'invalid') {
    return NextResponse.json({ error: 'requested_at must be a valid ISO-8601 timestamp' }, { status: 400 })
  }

  if (!getWeatherApiKey()) {
    return NextResponse.json(missingWeatherApiKeyPayload(), { status: 500 })
  }

  const offset = parseInteger(searchParams.get('offset'), 0, 0, QATAR_WEATHER_GRID_CELL_COUNT - 1)
  const limit = parseInteger(searchParams.get('limit'), QATAR_WEATHER_GRID_CELL_COUNT, 1, QATAR_WEATHER_GRID_CELL_COUNT)
  const grid = generateQatarWeatherGrid()
  const selectedCells = grid.slice(offset, offset + limit)

  try {
    const cells = await runInBatches(selectedCells, 12, async (cell) => {
      try {
        const reading = await fetchWeatherByCoordinates({
          latitude: cell.latitude,
          longitude: cell.longitude,
          requestedAt,
        })
        return {
          ...cell,
          reading,
          error: null,
        }
      } catch (error) {
        return {
          ...cell,
          reading: null,
          error: error instanceof Error ? error.message : 'Weather cell request failed',
        }
      }
    })

    return NextResponse.json(
      {
        totalCells: QATAR_WEATHER_GRID_CELL_COUNT,
        offset,
        limit,
        requestedAt,
        cells,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unable to load Qatar weather grid',
        details: error instanceof Error ? error.message : 'Unknown grid error',
      },
      { status: 502 }
    )
  }
}
