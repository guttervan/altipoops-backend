const express = require("express");
const CatholeEntry = require("../models/CatholeEntry");
const WaterSourceEntry = require("../models/WaterSourceEntry");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/me", requireAuth, async (request, response) => {
  try {
    const userId = request.user.userId;

    const catholesLogged = await CatholeEntry.count({
      where: { userId },
    });

    const waterSourcesLogged = await WaterSourceEntry.count({
      where: { userId },
    });

    const catholeEntries = await CatholeEntry.findAll({
      where: { userId },
      attributes: [
        "tpPackedOut",
        "distanceFromWater",
        "distanceFromTrail",
        "distanceFromCamp",
      ],
    });

    const highestCatholeElevation = await CatholeEntry.max("elevation", {
      where: { userId },
    });

    const highestWaterElevation = await WaterSourceEntry.max("elevation", {
      where: { userId },
    });

    const highestElevation = Math.max(
      highestCatholeElevation || 0,
      highestWaterElevation || 0
    );

    let tpPackOutRate = 0;
    let distanceComplianceRate = 0;

    if (catholeEntries.length > 0) {
      const packedOutCount = catholeEntries.filter(
        (entry) => entry.tpPackedOut === true
      ).length;

      tpPackOutRate = Math.round(
        (packedOutCount / catholeEntries.length) * 100
      );

      const compliantCount = catholeEntries.filter((entry) => {
        return (
          entry.distanceFromWater >= 200 &&
          entry.distanceFromTrail >= 200 &&
          entry.distanceFromCamp >= 200
        );
      }).length;

      distanceComplianceRate = Math.round(
        (compliantCount / catholeEntries.length) * 100
      );
    }

    response.status(200).json({
      stats: {
        catholesLogged,
        waterSourcesLogged,
        totalLogs: catholesLogged + waterSourcesLogged,
        tpPackOutRate,
        distanceComplianceRate,
        highestElevation,
      },
    });
  } catch (error) {
    console.error(error);

    response.status(500).json({
      message: "Something went wrong while loading your statistics.",
    });
  }
});

module.exports = router;