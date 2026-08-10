const express = require("express");

const router = express.Router();

const OPENROUTESERVICE_URL =
  "https://api.openrouteservice.org/v2/directions/foot-hiking/geojson";

function isValidLatitude(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

function validatePoint(point, label) {
  if (!point || typeof point !== "object") {
    return `${label} is required.`;
  }

  if (!isValidLatitude(point.latitude)) {
    return `${label}.latitude must be a number from -90 to 90.`;
  }

  if (!isValidLongitude(point.longitude)) {
    return `${label}.longitude must be a number from -180 to 180.`;
  }

  return null;
}

function distanceMetersBetween(start, end) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371008.8;

  const latitudeDifference = toRadians(
    end.latitude - start.latitude
  );

  const longitudeDifference = toRadians(
    end.longitude - start.longitude
  );

  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )
  );
}

function gradeColor(gradePercent) {
  const absoluteGrade = Math.abs(gradePercent);

  if (absoluteGrade >= 30) {
    return "#A63D32";
  }

  if (absoluteGrade >= 20) {
    return "#D9792B";
  }

  if (absoluteGrade >= 10) {
    return "#D6A629";
  }

  return "#31563A";
}

function buildGradientSegments(points) {
  const segments = [];

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const start = points[index - 1];
    const end = points[index];

    if (
      !Number.isFinite(start.elevationMeters) ||
      !Number.isFinite(end.elevationMeters)
    ) {
      continue;
    }

    const horizontalMeters = distanceMetersBetween(
      start,
      end
    );

    if (horizontalMeters < 1) {
      continue;
    }

    const elevationChangeMeters =
      end.elevationMeters - start.elevationMeters;

    const gradePercent =
      (elevationChangeMeters / horizontalMeters) * 100;

    segments.push({
      start: {
        latitude: start.latitude,
        longitude: start.longitude,
      },

      end: {
        latitude: end.latitude,
        longitude: end.longitude,
      },

      gradePercent,

      elevationChangeFeet:
        elevationChangeMeters * 3.28084,

      distanceMeters: horizontalMeters,

      color: gradeColor(gradePercent),
    });
  }

  return segments;
}

function calculateSustainedSteepestGrade(
  points,
  minimumWindowMeters = 30
) {
  let steepestGradePercent = 0;

  for (
    let startIndex = 0;
    startIndex < points.length - 1;
    startIndex += 1
  ) {
    const start = points[startIndex];

    if (!Number.isFinite(start.elevationMeters)) {
      continue;
    }

    let accumulatedDistanceMeters = 0;

    for (
      let endIndex = startIndex + 1;
      endIndex < points.length;
      endIndex += 1
    ) {
      accumulatedDistanceMeters += distanceMetersBetween(
        points[endIndex - 1],
        points[endIndex]
      );

      if (
        accumulatedDistanceMeters <
        minimumWindowMeters
      ) {
        continue;
      }

      const end = points[endIndex];

      if (Number.isFinite(end.elevationMeters)) {
        const elevationChangeMeters =
          end.elevationMeters -
          start.elevationMeters;

        const gradePercent =
          Math.abs(
            (
              elevationChangeMeters /
              accumulatedDistanceMeters
            ) * 100
          );

        if (
          Number.isFinite(gradePercent)
        ) {
          steepestGradePercent =
            Math.max(
              steepestGradePercent,
              gradePercent
            );
        }
      }

      break;
    }
  }

  return steepestGradePercent;
}

function getProviderMessage(
  providerData,
  responseText
) {
  const providerMessage =
    providerData?.error?.message ||
    providerData?.error ||
    providerData?.message;

  if (
    typeof providerMessage === "string" &&
    providerMessage.trim()
  ) {
    return providerMessage.trim();
  }

  return typeof responseText === "string"
    ? responseText.trim()
    : "";
}

function isRoutablePointError(message) {
  return (
    typeof message === "string" &&
    /could not find routable point|could not find point|within a radius/i.test(
      message
    )
  );
}

router.post(
  "/hiking",
  async (request, response) => {
    const apiKey =
      process.env.OPENROUTESERVICE_API_KEY;

    if (!apiKey) {
      return response.status(503).json({
        message:
          "Trail routing is not configured on the server.",
      });
    }

    const { start, end } =
      request.body || {};

    const startError = validatePoint(
      start,
      "start"
    );

    if (startError) {
      return response.status(400).json({
        message: startError,
      });
    }

    const endError = validatePoint(
      end,
      "end"
    );

    if (endError) {
      return response.status(400).json({
        message: endError,
      });
    }

    if (
      start.latitude === end.latitude &&
      start.longitude === end.longitude
    ) {
      return response.status(400).json({
        message:
          "The route start and destination must be different.",
      });
    }

    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      30000
    );

    try {
      const snapRadiusAttempts = [
        350,
        750,
        1500,
      ];

      let orsResponse = null;
      let responseText = "";
      let orsData = null;
      let usedSnapRadiusMeters =
        snapRadiusAttempts[0];

      for (
        let attemptIndex = 0;
        attemptIndex <
        snapRadiusAttempts.length;
        attemptIndex += 1
      ) {
        const snapRadiusMeters =
          snapRadiusAttempts[attemptIndex];

        usedSnapRadiusMeters =
          snapRadiusMeters;

        orsResponse = await fetch(
          OPENROUTESERVICE_URL,
          {
            method: "POST",

            headers: {
              Authorization: apiKey,
              "Content-Type":
                "application/json",
              Accept:
                "application/geo+json, application/json",
            },

            body: JSON.stringify({
              coordinates: [
                [
                  start.longitude,
                  start.latitude,
                ],

                [
                  end.longitude,
                  end.latitude,
                ],
              ],

              radiuses: [
                snapRadiusMeters,
                snapRadiusMeters,
              ],

              preference: "recommended",
              instructions: true,
              elevation: true,

              options: {
                avoid_features: [
                  "ferries",
                ],
              },
            }),

            signal: controller.signal,
          }
        );

        responseText =
          await orsResponse.text();

        try {
          orsData = responseText
            ? JSON.parse(responseText)
            : null;
        } catch {
          orsData = null;
        }

        if (orsResponse.ok) {
          break;
        }

        const providerMessage =
          getProviderMessage(
            orsData,
            responseText
          );

        const canRetryWithWiderRadius =
          attemptIndex <
            snapRadiusAttempts.length - 1 &&
          isRoutablePointError(
            providerMessage
          );

        if (!canRetryWithWiderRadius) {
          break;
        }

        console.warn(
          `OpenRouteService could not snap the route within ${snapRadiusMeters} m. Retrying with a wider radius.`
        );
      }

      if (!orsResponse) {
        return response
          .status(502)
          .json({
            message:
              "The hiking route provider did not return a response.",
          });
      }

      if (!orsResponse.ok) {
        console.error(
          "OpenRouteService error:",
          orsResponse.status,
          orsData || responseText
        );

        const providerMessage =
          getProviderMessage(
            orsData,
            responseText
          );

        return response
          .status(
            orsResponse.status === 404
              ? 404
              : 502
          )
          .json({
            message:
              providerMessage ||
              "The hiking route provider could not calculate this route.",
          });
      }

      const feature =
        orsData?.features?.[0];

      const coordinates =
        feature?.geometry?.coordinates;

      const summary =
        feature?.properties?.summary;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2
      ) {
        return response.status(502).json({
          message:
            "The hiking route provider returned no usable trail geometry.",
        });
      }

      const routePoints =
        coordinates
          .filter(
            (coordinate) =>
              Array.isArray(
                coordinate
              ) &&
              coordinate.length >= 2 &&
              Number.isFinite(
                Number(coordinate[0])
              ) &&
              Number.isFinite(
                Number(coordinate[1])
              )
          )
          .map(
            ([
              longitude,
              latitude,
              elevationMeters,
            ]) => ({
              latitude:
                Number(latitude),

              longitude:
                Number(longitude),

              elevationMeters:
                Number.isFinite(
                  Number(elevationMeters)
                )
                  ? Number(
                      elevationMeters
                    )
                  : null,

              elevationFeet:
                Number.isFinite(
                  Number(elevationMeters)
                )
                  ? Number(
                      elevationMeters
                    ) * 3.28084
                  : null,
            })
          );

      if (routePoints.length < 2) {
        return response.status(502).json({
          message:
            "The hiking route provider returned invalid trail geometry.",
        });
      }

      const gradientSegments =
        buildGradientSegments(
          routePoints
        );

      const totalAscentFeet =
        gradientSegments.reduce(
          (total, segment) =>
            total +
            Math.max(
              0,
              segment.elevationChangeFeet
            ),
          0
        );

      const totalDescentFeet =
        gradientSegments.reduce(
          (total, segment) =>
            total +
            Math.max(
              0,
              -segment.elevationChangeFeet
            ),
          0
        );

      const steepestGradePercent =
        calculateSustainedSteepestGrade(
          routePoints,
          30
        );

      return response
        .status(200)
        .json({
          profile: "foot-hiking",

          source:
            "openrouteservice",

          snapRadiusMeters:
            usedSnapRadiusMeters,

          distanceMeters:
            typeof summary?.distance ===
            "number"
              ? summary.distance
              : null,

          durationSeconds:
            typeof summary?.duration ===
            "number"
              ? summary.duration
              : null,

          coordinates:
            routePoints.map(
              (point) => ({
                latitude:
                  point.latitude,

                longitude:
                  point.longitude,

                elevationFeet:
                  point.elevationFeet,
              })
            ),

          gradientSegments,

          totalAscentFeet,

          totalDescentFeet,

          steepestGradePercent,

          steps:
            feature?.properties
              ?.segments?.[0]
              ?.steps || [],

          attribution:
            orsData?.metadata
              ?.attribution ||
            "openrouteservice.org | OpenStreetMap contributors",
        });
    } catch (error) {
      if (
        error.name ===
        "AbortError"
      ) {
        return response
          .status(504)
          .json({
            message:
              "Trail routing took too long. Please try again.",
          });
      }

      console.error(
        "Hiking route request failed:",
        error
      );

      return response
        .status(502)
        .json({
          message:
            "The server could not reach the hiking route provider.",
        });
    } finally {
      clearTimeout(timeout);
    }
  }
);

module.exports = router;