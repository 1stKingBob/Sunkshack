import type { PlaceCandidate } from '../types';

/**
 * Text search over Google Places, written against the API that a Google Cloud
 * project created today can actually enable.
 *
 * WHY THIS FILE EXISTS. The original code called
 * `new google.maps.places.PlacesService(map).textSearch(...)`. That is the
 * legacy Places service, and Google marked the whole legacy Places family
 * (Places API web service, the JavaScript PlacesService, the Android and iOS
 * SDKs) as Legacy on 1 March 2025. Legacy services stay switched on for
 * projects that already used them, but they cannot be enabled on a new Cloud
 * project. A brand-new key therefore cannot call textSearch at all — the
 * request comes back REQUEST_DENIED no matter how correct the key is, and the
 * only visible symptom is an empty result list.
 *
 * So: try `Place.searchByText` (Places API (New)) first, and keep the legacy
 * call as a fallback for an older project where it still works. Whichever
 * path answers, the caller gets the same normalised rows.
 *
 * Sources:
 *   https://developers.google.com/maps/legacy
 *   https://developers.google.com/maps/documentation/javascript/place-search
 */

export interface RawPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string | null;
  googleRating: number | null;
}

/**
 * `formattedAddress`, `types` and `rating` sit in dearer billing tiers than
 * the essentials. If the key or the enabled SKUs will not serve them the
 * request fails outright, so the second attempt drops to the two fields every
 * project can read. A map with names and pins beats no map.
 */
const FIELDS_FULL = ['displayName', 'formattedAddress', 'location', 'types', 'rating'];
const FIELDS_MINIMAL = ['displayName', 'location'];

type PlacesNS = typeof google.maps.places;

function normaliseNew(place: google.maps.places.Place): RawPlace | null {
  const loc = place.location;
  if (!place.id || !loc) return null;
  return {
    placeId: place.id,
    name: place.displayName ?? 'Unnamed place',
    address: place.formattedAddress ?? '',
    lat: loc.lat(),
    lng: loc.lng(),
    category: place.types?.[0]?.replace(/_/g, ' ') ?? null,
    googleRating: place.rating ?? null,
  };
}

function normaliseLegacy(r: google.maps.places.PlaceResult): RawPlace | null {
  const loc = r.geometry?.location;
  if (!r.place_id || !loc) return null;
  return {
    placeId: r.place_id,
    name: r.name ?? 'Unnamed place',
    address: r.formatted_address ?? r.vicinity ?? '',
    lat: loc.lat(),
    lng: loc.lng(),
    category: r.types?.[0]?.replace(/_/g, ' ') ?? null,
    googleRating: r.rating ?? null,
  };
}

async function searchNew(
  places: PlacesNS,
  query: string,
  center: google.maps.LatLng,
  fields: string[],
): Promise<RawPlace[]> {
  const { places: results } = await places.Place.searchByText({
    textQuery: query,
    fields,
    locationBias: { center, radius: 5000 },
    maxResultCount: 20,
  });
  return results.map(normaliseNew).filter((p): p is RawPlace => p !== null);
}

function searchLegacy(
  places: PlacesNS,
  map: google.maps.Map,
  query: string,
  center: google.maps.LatLng,
): Promise<RawPlace[]> {
  return new Promise((resolve, reject) => {
    const service = new places.PlacesService(map);
    service.textSearch({ query, location: center, radius: 5000 }, (res, status) => {
      if (status === places.PlacesServiceStatus.OK && res) {
        resolve(res.map(normaliseLegacy).filter((p): p is RawPlace => p !== null));
      } else if (status === places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error(status));
      }
    });
  });
}

export async function searchPlaces(map: google.maps.Map, query: string): Promise<RawPlace[]> {
  const center = map.getCenter();
  if (!center) throw new Error('The map has no centre yet — give it a moment and search again.');

  // importLibrary resolves whether the script was bootstrapped with
  // `libraries=places` or not, and guarantees `Place` is defined before use.
  const places = (await google.maps.importLibrary('places')) as PlacesNS;

  try {
    return await searchNew(places, query, center, FIELDS_FULL);
  } catch (newErr) {
    try {
      return await searchNew(places, query, center, FIELDS_MINIMAL);
    } catch {
      // Fall through to legacy.
    }
    try {
      return await searchLegacy(places, map, query, center);
    } catch (legacyErr) {
      throw new Error(
        `Places search failed. Places API (New): ${(newErr as Error).message}. ` +
          `Legacy Places: ${(legacyErr as Error).message}. ` +
          'Enable "Places API (New)" on this key\'s Google Cloud project — the legacy Places API ' +
          'cannot be switched on for projects created after 1 March 2025.',
      );
    }
  }
}

/** Convenience: turn raw places into the row shape the list and map render. */
export function toCandidate(
  raw: RawPlace,
  distanceM: number | null,
  score: PlaceCandidate['score'],
): PlaceCandidate {
  return { ...raw, distanceM, score };
}
