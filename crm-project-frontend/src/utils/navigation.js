/**
 * Universal Turn-by-Turn GPS Navigation Utility.
 * Launches Google Maps with live navigation / journey mode (dir_action=navigate).
 * 
 * When 'origin' is omitted, Google Maps automatically uses the device's live GPS ("Your location").
 * - On Mobile (Android / iOS): Opens Google Maps App and directly starts turn-by-turn voice navigation journey.
 * - On Laptop / Desktop: Opens Google Maps web, sets starting point to 'Your location', and starts the route directions.
 * 
 * IMPORTANT: Opens synchronously inside the click event so browser pop-up blockers never intercept it.
 */

export async function getCurrentCoordinates() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null, accuracy: null };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Number(pos.coords.accuracy.toFixed(1)),
        });
      },
      () => {
        resolve({ latitude: null, longitude: null, accuracy: null });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  });
}

export function getGoogleMapsNavigationUrl({ latitude, longitude, address }) {
  const hasCoords =
    latitude !== undefined &&
    latitude !== null &&
    String(latitude).trim() !== "" &&
    !isNaN(Number(latitude)) &&
    longitude !== undefined &&
    longitude !== null &&
    String(longitude).trim() !== "" &&
    !isNaN(Number(longitude));

  let destParam = "";
  if (hasCoords) {
    destParam = `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  } else if (address && String(address).trim()) {
    destParam = encodeURIComponent(String(address).trim());
  }

  if (!destParam) return "";

  // Universal Google Maps URL with dir_action=navigate for turn-by-turn navigation mode
  return `https://www.google.com/maps/dir/?api=1&destination=${destParam}&travelmode=driving&dir_action=navigate`;
}

export function navigateToLocation({
  latitude,
  longitude,
  address,
  destinationName = "Service Site",
}) {
  const navUrl = getGoogleMapsNavigationUrl({ latitude, longitude, address });

  if (!navUrl) {
    alert(
      "No site GPS coordinates or address are set for this site.\n\nPlease click '+ Pin Now' on the site card to set the location on the map."
    );
    return;
  }

  // Detect Android to optionally launch native intent, or universal link
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  // Synchronous launch to prevent browser pop-up blockers
  try {
    const newWindow = window.open(navUrl, "_blank", "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // Fallback if popup was blocked: redirect current tab on mobile
      if (isAndroid || /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = navUrl;
      }
    }
  } catch (err) {
    console.warn("window.open failed, navigating via location.href:", err);
    window.location.href = navUrl;
  }
}

/**
 * Returns a direct Google Maps preview/pin link for given coordinates or address
 */
export function getGoogleMapsPinUrl(latitude, longitude, address) {
  if (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude))
  ) {
    return `https://www.google.com/maps?q=${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  }
  if (address) {
    return `https://www.google.com/maps?q=${encodeURIComponent(String(address).trim())}`;
  }
  return "";
}
