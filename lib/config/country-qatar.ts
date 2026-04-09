/**
 * Growa Qatar - Country-Specific Configuration
 * Step 0.3: Qatar deployment configuration
 * 
 * This module contains Qatar-specific settings that customize
 * the Growa platform for the Qatar deployment.
 */

import type { CountryCode } from './deployment'

export interface CountryConfig {
  code: CountryCode
  name: {
    en: string
    ar: string
  }
  branding: {
    primaryColor: string
    // Additional branding tokens will be defined in Phase 3
  }
  legal: {
    entityLabel: {
      en: string
      ar: string
    }
    // Additional legal labels will be defined in Phase 1
  }
  geography: {
    defaultCenter: {
      lat: number
      lng: number
    }
    defaultZoom: number
    bounds: {
      north: number
      south: number
      east: number
      west: number
    }
  }
  organizations: {
    // Placeholder for organization types allowed in Qatar
    // Will be populated in Phase 1
    allowedTypes: string[]
  }
}

/**
 * Qatar country configuration.
 * This is the first sovereign country deployment of the Growa platform.
 */
export const qatarConfig: CountryConfig = {
  code: 'QA',
  name: {
    en: 'Qatar',
    ar: 'قطر',
  },
  branding: {
    primaryColor: '#8B0000', // Qatar maroon - will be refined in Phase 3
  },
  legal: {
    entityLabel: {
      en: 'State of Qatar',
      ar: 'دولة قطر',
    },
  },
  geography: {
    // Qatar's approximate center
    defaultCenter: {
      lat: 25.3548,
      lng: 51.1839,
    },
    defaultZoom: 9,
    // Qatar's approximate bounding box
    bounds: {
      north: 26.2,
      south: 24.4,
      east: 51.7,
      west: 50.7,
    },
  },
  organizations: {
    // Will be populated with: ministry, sovereign_entity, state_operator,
    // financial_institution, research_entity, external_operator
    allowedTypes: [],
  },
}

/**
 * Get the country configuration for the current deployment.
 * Currently only Qatar is supported.
 */
export function getCountryConfig(countryCode: CountryCode): CountryConfig {
  switch (countryCode) {
    case 'QA':
      return qatarConfig
    default:
      throw new Error(`Unsupported country code: ${countryCode}`)
  }
}
