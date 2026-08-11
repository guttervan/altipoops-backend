const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const {
  ValidationError,
  UniqueConstraintError,
} = require("sequelize");

const sequelize = require("../config/database");

const User = require("../models/User");
const Trip = require("../models/Trip");
const WaterSourceEntry = require("../models/WaterSourceEntry");
const CatholeEntry = require("../models/CatholeEntry");
const BeerSpotEntry = require("../models/BeerSpotEntry");
const NatureObservation = require("../models/NatureObservation");
const BirdObservation = require("../models/BirdObservation");

const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsDirectory = path.join(
  __dirname,
  "..",
  "..",
  "uploads"
);

function cloudinaryPublicIdFromUrl(assetUrl) {
  try {
    const parsedUrl = new URL(assetUrl);

    if (
      parsedUrl.hostname !==
      "res.cloudinary.com"
    ) {
      return null;
    }

    const uploadMarker =
      "/upload/";

    const markerIndex =
      parsedUrl.pathname.indexOf(
        uploadMarker
      );

    if (markerIndex === -1) {
      return null;
    }

    let assetPath =
      parsedUrl.pathname.slice(
        markerIndex +
          uploadMarker.length
      );

    assetPath =
      assetPath.replace(
        /^v\d+\//,
        ""
      );

    assetPath =
      decodeURIComponent(
        assetPath
      );

    return assetPath.replace(
      /\.[^/.]+$/,
      ""
    );
  } catch {
    return null;
  }
}

async function deleteStoredAsset(
  assetUrl,
  resourceType = "image"
) {
  if (!assetUrl) {
    return;
  }

  const publicId =
    cloudinaryPublicIdFromUrl(
      assetUrl
    );

  if (publicId) {
    const result =
      await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type:
            resourceType,
          invalidate: true,
        }
      );

    if (
      result?.result !== "ok" &&
      result?.result !== "not found"
    ) {
      throw new Error(
        `Cloudinary could not delete asset ${publicId}.`
      );
    }

    return;
  }

  if (
    !String(assetUrl).startsWith(
      "/uploads/"
    )
  ) {
    return;
  }

  const filename =
    path.basename(assetUrl);

  const fullPath =
    path.join(
      uploadsDirectory,
      filename
    );

  try {
    await fs.promises.unlink(
      fullPath
    );
  } catch (error) {
    if (
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

router.post(
  "/register",
  async (
    request,
    response
  ) => {
    try {
      const {
        displayName,
        email,
        password,
        homeRegion,
      } =
        request.body || {};

      if (
        !displayName ||
        !email ||
        !password
      ) {
        return response
          .status(400)
          .json({
            message:
              "Display name, email, and password are required.",
          });
      }

      if (
        password.length < 8
      ) {
        return response
          .status(400)
          .json({
            message:
              "Password must be at least 8 characters long.",
          });
      }

      if (
        !/[A-Z]/.test(
          password
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Password must include at least one uppercase letter.",
          });
      }

      if (
        !/[a-z]/.test(
          password
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Password must include at least one lowercase letter.",
          });
      }

      if (
        !/[0-9]/.test(
          password
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Password must include at least one number.",
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const existingUser =
        await User.findOne({
          where: {
            email:
              normalizedEmail,
          },
        });

      if (existingUser) {
        return response
          .status(409)
          .json({
            message:
              "An account with that email already exists.",
          });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      const user =
        await User.create({
          displayName,
          email:
            normalizedEmail,
          passwordHash,
          homeRegion:
            homeRegion ||
            null,
        });

      response
        .status(201)
        .json({
          message:
            "User registered successfully!",

          user: {
            id: user.id,

            displayName:
              user.displayName,

            email:
              user.email,

            homeRegion:
              user.homeRegion,

            privacySetting:
              user.privacySetting,
          },
        });
    } catch (error) {
      console.error(
        error
      );

      if (
        error instanceof
        UniqueConstraintError
      ) {
        return response
          .status(409)
          .json({
            message:
              "An account with that email already exists.",
          });
      }

      if (
        error instanceof
        ValidationError
      ) {
        return response
          .status(400)
          .json({
            message:
              error.errors[0]
                ?.message ||
              "Invalid registration information.",
          });
      }

      response
        .status(500)
        .json({
          message:
            "Something went wrong while registering the user.",
        });
    }
  }
);

router.post(
  "/login",
  async (
    request,
    response
  ) => {
    try {
      const {
        email,
        password,
      } =
        request.body || {};

      if (
        !email ||
        !password
      ) {
        return response
          .status(400)
          .json({
            message:
              "Email and password are required.",
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const user =
        await User.findOne({
          where: {
            email:
              normalizedEmail,
          },
        });

      if (!user) {
        return response
          .status(401)
          .json({
            message:
              "Invalid email or password.",
          });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.passwordHash
        );

      if (
        !passwordMatches
      ) {
        return response
          .status(401)
          .json({
            message:
              "Invalid email or password.",
          });
      }

      const token =
        jwt.sign(
          {
            userId:
              user.id,

            email:
              user.email,
          },
          process.env
            .JWT_SECRET,
          {
            expiresIn:
              "7d",
          }
        );

      response
        .status(200)
        .json({
          message:
            "Login successful!",

          token,

          user: {
            id: user.id,

            displayName:
              user.displayName,

            email:
              user.email,

            homeRegion:
              user.homeRegion,

            privacySetting:
              user.privacySetting,
          },
        });
    } catch (error) {
      console.error(
        error
      );

      response
        .status(500)
        .json({
          message:
            "Something went wrong while logging in.",
        });
    }
  }
);

router.get(
  "/me",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const user =
        await User.findByPk(
          request.user.userId,
          {
            attributes: {
              exclude: [
                "passwordHash",
              ],
            },
          }
        );

      if (!user) {
        return response
          .status(404)
          .json({
            message:
              "User not found.",
          });
      }

      response
        .status(200)
        .json({
          user,
        });
    } catch (error) {
      console.error(
        error
      );

      response
        .status(500)
        .json({
          message:
            "Something went wrong while loading the user.",
        });
    }
  }
);

router.put(
  "/me",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const user =
        await User.findByPk(
          request.user.userId
        );

      if (!user) {
        return response
          .status(404)
          .json({
            message:
              "User not found.",
          });
      }

      const {
        displayName,
        homeRegion,
        privacySetting,
      } =
        request.body || {};

      const allowedPrivacySettings =
        [
          "private",
          "friends",
          "public",
        ];

      if (
        privacySetting !==
          undefined &&
        !allowedPrivacySettings.includes(
          privacySetting
        )
      ) {
        return response
          .status(400)
          .json({
            message:
              "Privacy setting must be private, friends, or public.",
          });
      }

      await user.update({
        displayName:
          displayName ??
          user.displayName,

        homeRegion:
          homeRegion ??
          user.homeRegion,

        privacySetting:
          privacySetting ??
          user.privacySetting,
      });

      response
        .status(200)
        .json({
          message:
            "Profile updated successfully!",

          user: {
            id: user.id,

            displayName:
              user.displayName,

            email:
              user.email,

            homeRegion:
              user.homeRegion,

            privacySetting:
              user.privacySetting,
          },
        });
    } catch (error) {
      console.error(
        error
      );

      if (
        error instanceof
        ValidationError
      ) {
        return response
          .status(400)
          .json({
            message:
              error.errors[0]
                ?.message ||
              "Invalid profile information.",
          });
      }

      response
        .status(500)
        .json({
          message:
            "Something went wrong while updating the profile.",
        });
    }
  }
);

router.delete(
  "/me",
  requireAuth,
  async (
    request,
    response
  ) => {
    try {
      const {
        password,
      } =
        request.body || {};

      if (!password) {
        return response
          .status(400)
          .json({
            message:
              "Your password is required to delete your account.",
          });
      }

      const user =
        await User.findByPk(
          request.user.userId
        );

      if (!user) {
        return response
          .status(404)
          .json({
            message:
              "User not found.",
          });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.passwordHash
        );

      if (
        !passwordMatches
      ) {
        return response
          .status(401)
          .json({
            message:
              "Password is incorrect.",
          });
      }

      const userId =
        user.id;

      const [
        waterSources,
        catholes,
        beerSpots,
        natureObservations,
        birdObservations,
      ] =
        await Promise.all([
          WaterSourceEntry.findAll({
            where: {
              userId,
            },

            attributes: [
              "id",
              "photoUrl",
            ],
          }),

          CatholeEntry.findAll({
            where: {
              userId,
            },

            attributes: [
              "id",
              "photoUrl",
            ],
          }),

          BeerSpotEntry.findAll({
            where: {
              userId,
            },

            attributes: [
              "id",
              "photoUrl",
            ],
          }),

          NatureObservation.findAll({
            where: {
              userId,
            },

            attributes: [
              "id",
              "photoUrl",
            ],
          }),

          BirdObservation.findAll({
            where: {
              userId,
            },

            attributes: [
              "id",
              "audioUrl",
            ],
          }),
        ]);

      const mediaAssets = [
        ...waterSources
          .filter(
            (entry) =>
              entry.photoUrl
          )
          .map(
            (entry) => ({
              url:
                entry.photoUrl,
              resourceType:
                "image",
            })
          ),

        ...catholes
          .filter(
            (entry) =>
              entry.photoUrl
          )
          .map(
            (entry) => ({
              url:
                entry.photoUrl,
              resourceType:
                "image",
            })
          ),

        ...beerSpots
          .filter(
            (entry) =>
              entry.photoUrl
          )
          .map(
            (entry) => ({
              url:
                entry.photoUrl,
              resourceType:
                "image",
            })
          ),

        ...natureObservations
          .filter(
            (entry) =>
              entry.photoUrl
          )
          .map(
            (entry) => ({
              url:
                entry.photoUrl,
              resourceType:
                "image",
            })
          ),

        ...birdObservations
          .filter(
            (entry) =>
              entry.audioUrl
          )
          .map(
            (entry) => ({
              url:
                entry.audioUrl,
              resourceType:
                "video",
            })
          ),
      ];

      for (
        const asset of
        mediaAssets
      ) {
        await deleteStoredAsset(
          asset.url,
          asset.resourceType
        );
      }

      await sequelize.transaction(
        async (
          transaction
        ) => {
          await BirdObservation.destroy({
            where: {
              userId,
            },
            transaction,
          });

          await NatureObservation.destroy({
            where: {
              userId,
            },
            transaction,
          });

          await BeerSpotEntry.destroy({
            where: {
              userId,
            },
            transaction,
          });

          await CatholeEntry.destroy({
            where: {
              userId,
            },
            transaction,
          });

          await WaterSourceEntry.destroy({
            where: {
              userId,
            },
            transaction,
          });

          await Trip.destroy({
            where: {
              userId,
            },
            transaction,
          });

          await User.destroy({
            where: {
              id:
                userId,
            },
            transaction,
          });
        }
      );

      response
        .status(200)
        .json({
          message:
            "Your Altipoop account and saved data were deleted.",
        });
    } catch (error) {
      console.error(
        "Account deletion error:",
        error
      );

      response
        .status(500)
        .json({
          message:
            "Something went wrong while deleting your account. Your account was not fully deleted.",
        });
    }
  }
);

module.exports = router;