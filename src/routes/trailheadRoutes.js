const express = require("express");

const router = express.Router();

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map();

function validCoordinate(value, minimum, maximum) {
  const number = Number(value);

  return Number.isFinite(number) &&
    number >= minimum &&
    number <= maximum
    ? number
    : null;
}

function clampInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number.parseInt(
    String(value ?? ""),
    10
  );

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(minimum, number)
  );
}

function distanceMiles(
  startLatitude,
  startLongitude,
  endLatitude,
  endLongitude
) {
  const toRadians = (value) =>
    (value * Math.PI) / 180;

  const earthRadiusMiles = 3958.8;

  const latitudeDifference = toRadians(
    endLatitude - startLatitude
  );

  const longitudeDifference = toRadians(
    endLongitude - startLongitude
  );

  const startLatitudeRadians =
    toRadians(startLatitude);

  const endLatitudeRadians =
    toRadians(endLatitude);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    earthRadiusMiles *
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )
  );
}

function elementCoordinate(element) {
  const latitude = Number(
    element?.lat ?? element?.center?.lat
  );

  const longitude = Number(
    element?.lon ?? element?.center?.lon
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function trailheadName(element) {
  const tags = element?.tags || {};

  return (
    tags.name ||
    tags["name:en"] ||
    tags.official_name ||
    tags.ref ||
    "Unnamed trailhead"
  );
}

router.get(
  "/nearby",
  async (request, response) => {
    const latitude = validCoordinate(
      request.query.latitude,
      -90,
      90
    );

    const longitude = validCoordinate(
      request.query.longitude,
      -180,
      180
    );

    if (
      latitude === null ||
      longitude === null
    ) {
      return response.status(400).json({
        message:
          "Valid latitude and longitude query parameters are required.",
      });
    }

    const radiusMiles = clampInteger(
      request.query.radiusMiles,
      25,
      1,
      50
    );

    const limit = clampInteger(
      request.query.limit,
      15,
      1,
      30
    );

    const radiusMeters = Math.round(
      radiusMiles * 1609.344
    );

    const cacheKey =
      `${latitude.toFixed(4)}:` +
      `${longitude.toFixed(4)}:` +
      `${radiusMiles}:` +
      `${limit}`;

    const cached = cache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.createdAt <
        CACHE_TTL_MS
    ) {
      return response.status(200).json({
        ...cached.payload,
        cached: true,
      });
    }

    const overpassQuery = `
      [out:json][timeout:15];
      (
        node["highway"="trailhead"]
          (around:${radiusMeters},${latitude},${longitude});

        way["highway"="trailhead"]
          (around:${radiusMeters},${latitude},${longitude});

        relation["highway"="trailhead"]
          (around:${radiusMeters},${latitude},${longitude});
      );
      out center tags;
    `;

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      18000
    );

    try {
      const providerResponse =
        await fetch(OVERPASS_URL, {
          method: "POST",

          headers: {
            Accept: "application/json",

            "Content-Type":
              "application/x-www-form-urlencoded;charset=UTF-8",

            "User-Agent":
              "Altipoop/1.0 nearby-trailheads",
          },

          body: new URLSearchParams({
            data: overpassQuery,
          }).toString(),

          signal: controller.signal,
        });

      const responseText =
        await providerResponse.text();

      let providerData = null;

      try {
        providerData = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        providerData = null;
      }

      if (
        !providerResponse.ok ||
        !Array.isArray(
          providerData?.elements
        )
      ) {
        console.error(
          "Overpass trailhead error:",
          providerResponse.status,
          responseText
        );

        return response.status(502).json({
          message:
            "The public trailhead service is temporarily unavailable.",
        });
      }

      const seen = new Set();

      const trailheads =
        providerData.elements
          .map((element) => {
            const coordinate =
              elementCoordinate(element);

            if (!coordinate) {
              return null;
            }

            const name =
              trailheadName(element);

            const duplicateKey =
              `${name.toLowerCase()}:` +
              `${coordinate.latitude.toFixed(4)}:` +
              `${coordinate.longitude.toFixed(4)}`;

            if (seen.has(duplicateKey)) {
              return null;
            }

            seen.add(duplicateKey);

            return {
              id:
                `osm-${element.type}-` +
                `${element.id}`,

              name,

              latitude:
                coordinate.latitude,

              longitude:
                coordinate.longitude,

              distanceMiles:
                distanceMiles(
                  latitude,
                  longitude,
                  coordinate.latitude,
                  coordinate.longitude
                ),

              parking:
                element.tags?.parking ||
                null,

              access:
                element.tags?.access ||
                null,

              surface:
                element.tags?.surface ||
                null,

              description:
                element.tags?.description ||
                element.tags?.note ||
                null,

              source:
                "openstreetmap",
            };
          })
          .filter(Boolean)
          .sort(
            (first, second) =>
              first.distanceMiles -
              second.distanceMiles
          )
          .slice(0, limit);

      const payload = {
        center: {
          latitude,
          longitude,
        },

        radiusMiles,

        count: trailheads.length,

        trailheads,

        attribution:
          "© OpenStreetMap contributors",
      };

      cache.set(cacheKey, {
        createdAt: Date.now(),
        payload,
      });

      if (cache.size > 200) {
        const oldestKey =
          cache.keys().next().value;

        cache.delete(oldestKey);
      }

      return response.status(200).json({
        ...payload,
        cached: false,
      });
    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        return response.status(504).json({
          message:
            "The trailhead search took too long. Please try again.",
        });
      }

      console.error(
        "Nearby trailhead request failed:",
        error
      );

      return response.status(502).json({
        message:
          "The server could not reach the public trailhead service.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
);

module.exports = router;