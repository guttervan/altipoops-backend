const express = require("express");
const {
  Op,
} = require("sequelize");

const WaterSourceEntry =
  require("../models/WaterSourceEntry");

const CairnEntry =
  require("../models/CairnEntry");

const PublicTrack =
  require("../models/PublicTrack");

const router =
  express.Router();

function publicCoordinate(value) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue
    )
  ) {
    return null;
  }

  // Roughly neighborhood/trail-area precision instead of exposing
  // the exact private GPS point on the public website.
  return Number(
    numberValue.toFixed(3)
  );
}


function publicCairnCoordinate(value) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(
      numberValue
    )
  ) {
    return null;
  }

  // Cairns are more sensitive than ordinary field observations.
  // Round to roughly kilometer-scale precision for the public site.
  return Number(
    numberValue.toFixed(2)
  );
}

function publicPhotoUrl(
  request,
  photoUrl
) {
  if (!photoUrl) {
    return null;
  }

  if (
    /^https?:\/\//i.test(
      photoUrl
    )
  ) {
    return photoUrl;
  }

  return `${request.protocol}://${request.get("host")}${photoUrl}`;
}

function normalizeDays(value) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isFinite(parsed)
  ) {
    return 7;
  }

  return Math.min(
    Math.max(
      parsed,
      1
    ),
    30
  );
}

function safeNumber(value) {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : 0;
}

function sumSignalCounts(
  totals,
  counts
) {
  if (
    !counts ||
    typeof counts !== "object" ||
    Array.isArray(counts)
  ) {
    return totals;
  }

  for (
    const [
      rawKey,
      rawValue,
    ] of Object.entries(
      counts
    )
  ) {
    const key =
      String(rawKey || "")
        .trim()
        .toLowerCase();

    if (!key) {
      continue;
    }

    const value =
      safeNumber(
        rawValue
      );

    totals[key] =
      safeNumber(
        totals[key]
      ) +
      value;
  }

  return totals;
}

function normalizePublicPhotos(
  request,
  photos
) {
  if (
    !Array.isArray(
      photos
    )
  ) {
    return [];
  }

  return photos.map(
    (photo) => {
      if (
        typeof photo ===
        "string"
      ) {
        return publicPhotoUrl(
          request,
          photo
        );
      }

      if (
        !photo ||
        typeof photo !==
        "object"
      ) {
        return photo;
      }

      const copy = {
        ...photo,
      };

      if (copy.url) {
        copy.url =
          publicPhotoUrl(
            request,
            copy.url
          );
      }

      if (copy.photoUrl) {
        copy.photoUrl =
          publicPhotoUrl(
            request,
            copy.photoUrl
          );
      }

      return copy;
    }
  );
}

function serializePublicTrack(
  request,
  track
) {
  return {
    publicId:
      track.publicId,

    title:
      track.title || null,

    sharedAt:
      track.sharedAt,

    activityDate:
      track.activityDate,

    privacyMode:
      track.privacyMode,

    geometry:
      track.geometry || [],

    publicPointCount:
      safeNumber(
        track.publicPointCount
      ),

    startTrimMiles:
      safeNumber(
        track.startTrimMiles
      ),

    endTrimMiles:
      safeNumber(
        track.endTrimMiles
      ),

    locationPrecision:
      track.locationPrecision ||
      "approximate",

    distanceMiles:
      safeNumber(
        track.distanceMiles
      ),

    elevationGainFt:
      track.elevationGainFt === null
        ? null
        : safeNumber(
            track.elevationGainFt
          ),

    elevationLossFt:
      track.elevationLossFt === null
        ? null
        : safeNumber(
            track.elevationLossFt
          ),

    highPointFt:
      track.highPointFt === null
        ? null
        : safeNumber(
            track.highPointFt
          ),

    lowPointFt:
      track.lowPointFt === null
        ? null
        : safeNumber(
            track.lowPointFt
          ),

    movingTimeSeconds:
      track.movingTimeSeconds === null
        ? null
        : safeNumber(
            track.movingTimeSeconds
          ),

    elapsedTimeSeconds:
      track.elapsedTimeSeconds === null
        ? null
        : safeNumber(
            track.elapsedTimeSeconds
          ),

    startedAtPublic:
      track.startedAtPublic,

    region:
      track.region || null,

    terrainTags:
      Array.isArray(
        track.terrainTags
      )
        ? track.terrainTags
        : [],

    fieldSignalCounts:
      track.fieldSignalCounts &&
      typeof track.fieldSignalCounts ===
        "object"
        ? track.fieldSignalCounts
        : {},

    publicObservations:
      Array.isArray(
        track.publicObservations
      )
        ? track.publicObservations
        : [],

    publicPhotos:
      normalizePublicPhotos(
        request,
        track.publicPhotos
      ),

    elevationProfile:
      Array.isArray(
        track.elevationProfile
      )
        ? track.elevationProfile
        : [],

    isAnonymous:
      track.isAnonymous !==
      false,

    displayName:
      track.isAnonymous
        ? null
        : track.displayName ||
          null,
  };
}

router.get(
  "/feed",
  async (
    request,
    response
  ) => {
    try {
      const waterSources =
        await WaterSourceEntry.findAll({
          where: {
            isPublic: true,
          },

          order: [
            [
              "createdAt",
              "DESC",
            ],
          ],

          limit: 50,
        });

      const cairns =
        await CairnEntry.findAll({
          where: {
            isPublic: true,

            locationMode: {
              [Op.ne]: "private",
            },
          },

          order: [
            [
              "collectedAt",
              "DESC",
            ],
          ],

          limit: 50,
        });

      const waterItems =
        waterSources.map(
          (entry) => ({
            id:
              `water-${entry.id}`,

            type:
              "water",

            sourceType:
              entry.sourceType,

            flowRating:
              entry.flowRating,

            elevation:
              entry.elevation ===
              null
                ? null
                : Number(
                    entry.elevation
                  ),

            lastConfirmedDate:
              entry.lastConfirmedDate,

            notes:
              entry.notes ||
              null,

            potabilityNotes:
              entry.potabilityNotes ||
              null,

            photoUrl:
              publicPhotoUrl(
                request,
                entry.photoUrl
              ),

            location: {
              latitude:
                publicCoordinate(
                  entry.latitude
                ),

              longitude:
                publicCoordinate(
                  entry.longitude
                ),
            },

            createdAt:
              entry.createdAt,

            updatedAt:
              entry.updatedAt,
          })
        );

      const cairnItems =
        cairns.map(
          (entry) => ({
            id:
              `cairn-${entry.id}`,

            type:
              "cairn",

            category:
              entry.category,

            hikeTitle:
              entry.hikeTitle ||
              null,

            elevationFeet:
              entry.elevationFeet ===
              null
                ? null
                : Number(
                    entry.elevationFeet
                  ),

            note:
              entry.note ||
              null,

            photoUrl:
              publicPhotoUrl(
                request,
                entry.photoUrl
              ),

            locationMode:
              entry.locationMode,

            location: {
              latitude:
                publicCairnCoordinate(
                  entry.latitude
                ),

              longitude:
                publicCairnCoordinate(
                  entry.longitude
                ),
            },

            collectedAt:
              entry.collectedAt,

            createdAt:
              entry.createdAt,

            updatedAt:
              entry.updatedAt,
          })
        );

      const items = [
        ...waterItems,
        ...cairnItems,
      ]
        .sort(
          (a, b) =>
            Date.parse(
              b.collectedAt ||
              b.createdAt ||
              ""
            ) -
            Date.parse(
              a.collectedAt ||
              a.createdAt ||
              ""
            )
        )
        .slice(0, 100);

      response
        .status(200)
        .json({
          count:
            items.length,

          items,
        });
    } catch (error) {
      console.error(
        "Could not load public feed:",
        error
      );

      response
        .status(500)
        .json({
          message:
            "Could not load the public Altipoop feed.",
        });
    }
  }
);

router.get(
  "/activity",
  async (
    request,
    response
  ) => {
    try {
      const days =
        normalizeDays(
          request.query.days
        );

      const cutoff =
        new Date();

      cutoff.setUTCDate(
        cutoff.getUTCDate() -
          days
      );

      const publicTracks =
        await PublicTrack.findAll({
          where: {
            status:
              "active",

            sharedAt: {
              [Op.gte]:
                cutoff,
            },
          },

          order: [
            [
              "sharedAt",
              "DESC",
            ],
          ],

          limit: 100,
        });

      const publicCairnCount =
        await CairnEntry.count({
          where: {
            isPublic: true,

            locationMode: {
              [Op.ne]: "private",
            },

            collectedAt: {
              [Op.gte]: cutoff,
            },
          },
        });

      const signalTotals =
        {};

      if (publicCairnCount > 0) {
        signalTotals.cairn =
          publicCairnCount;
      }

      let totalMiles =
        0;

      let totalElevationGainFt =
        0;

      for (
        const track of
        publicTracks
      ) {
        totalMiles +=
          safeNumber(
            track.distanceMiles
          );

        totalElevationGainFt +=
          safeNumber(
            track.elevationGainFt
          );

        sumSignalCounts(
          signalTotals,
          track.fieldSignalCounts
        );
      }

      const totalFieldSignals =
        Object.values(
          signalTotals
        ).reduce(
          (
            sum,
            value
          ) =>
            sum +
            safeNumber(
              value
            ),
          0
        );

      const tracks =
        publicTracks.map(
          (track) =>
            serializePublicTrack(
              request,
              track
            )
        );

      response
        .status(200)
        .json({
          windowDays:
            days,

          generatedAt:
            new Date()
              .toISOString(),

          summary: {
            publicTracks:
              tracks.length,

            milesMoved:
              Number(
                totalMiles.toFixed(
                  1
                )
              ),

            elevationGainFt:
              Math.round(
                totalElevationGainFt
              ),

            activeCorridors:
              0,

            fieldSignals:
              Math.round(
                totalFieldSignals
              ),

            signalCounts:
              signalTotals,
          },

          corridors: [],

          tracks,
        });
    } catch (error) {
      console.error(
        "Could not load public activity:",
        error
      );

      response
        .status(500)
        .json({
          message:
            "Could not load public Altipoop activity.",
        });
    }
  }
);

module.exports =
  router;
