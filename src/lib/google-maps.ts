/**
 * Lazy-loads the Google Maps JavaScript API (Places library only).
 * Returns the `google.maps.places` namespace.
 */

let loadPromise: Promise<typeof google.maps.places> | null = null;

export function loadGooglePlaces(): Promise<typeof google.maps.places> {
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  }

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve(window.google.maps.places);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.places) {
        resolve(window.google.maps.places);
      } else {
        reject(new Error("Google Maps Places library failed to initialise"));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface QueryPrediction {
  description: string;
  placeId?: string;
  mainText: string;
  secondaryText: string;
}

/**
 * Calls Google Places Query Autocomplete via the JS API.
 * Falls back gracefully if API key is missing.
 */
export async function queryAutocomplete(input: string): Promise<QueryPrediction[]> {
  const places = await loadGooglePlaces();
  const service = new places.AutocompleteService();

  return new Promise((resolve) => {
    service.getQueryPredictions({ input }, (predictions, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);
        return;
      }
      resolve(
        predictions.map((p) => ({
          description: p.description,
          placeId: p.place_id ?? undefined,
          mainText: p.structured_formatting.main_text,
          secondaryText: p.structured_formatting.secondary_text ?? "",
        }))
      );
    });
  });
}
