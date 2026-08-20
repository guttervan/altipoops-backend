const {
  DataTypes,
} = require("sequelize");

const sequelize =
  require("../config/database");

const User =
  require("./User");

const FinishedHike =
  require("./FinishedHike");

const PublicTrack =
  sequelize.define(
    "PublicTrack",
    {
      id: {
        type:
          DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },

      publicId: {
        type:
          DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      sourceHikeId: {
        type:
          DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      title: {
        type:
          DataTypes.STRING,
        allowNull: true,
      },

      sharedAt: {
        type:
          DataTypes.DATE,
        allowNull: false,
      },

      activityDate: {
        type:
          DataTypes.DATEONLY,
        allowNull: true,
      },

      privacyMode: {
        type:
          DataTypes.STRING,
        allowNull: false,
        defaultValue:
          "masked",
        validate: {
          isIn: [
            [
              "corridor",
              "masked",
              "full",
            ],
          ],
        },
      },

      geometry: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      originalPointCount: {
        type:
          DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      publicPointCount: {
        type:
          DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      startTrimMiles: {
        type:
          DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },

      endTrimMiles: {
        type:
          DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },

      locationPrecision: {
        type:
          DataTypes.STRING,
        allowNull: false,
        defaultValue:
          "approximate",
      },

      distanceMiles: {
        type:
          DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },

      elevationGainFt: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      elevationLossFt: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      highPointFt: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      lowPointFt: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      movingTimeSeconds: {
        type:
          DataTypes.INTEGER,
        allowNull: true,
      },

      elapsedTimeSeconds: {
        type:
          DataTypes.INTEGER,
        allowNull: true,
      },

      startedAtPublic: {
        type:
          DataTypes.DATE,
        allowNull: true,
      },

      region: {
        type:
          DataTypes.STRING,
        allowNull: true,
      },

      terrainTags: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      fieldSignalCounts: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      publicObservations: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      publicPhotos: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      elevationProfile: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      isAnonymous: {
        type:
          DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      displayName: {
        type:
          DataTypes.STRING,
        allowNull: true,
      },

      status: {
        type:
          DataTypes.STRING,
        allowNull: false,
        defaultValue:
          "active",
        validate: {
          isIn: [
            [
              "active",
              "hidden",
              "deleted",
            ],
          ],
        },
      },
    },
    {
      tableName:
        "public_tracks",

      timestamps: true,

      indexes: [
        {
          unique: true,
          fields: [
            "publicId",
          ],
        },

        {
          unique: true,
          fields: [
            "sourceHikeId",
          ],
        },

        {
          fields: [
            "status",
            "sharedAt",
          ],
        },

        {
          fields: [
            "privacyMode",
            "sharedAt",
          ],
        },

        {
          fields: [
            "region",
            "activityDate",
          ],
        },

        {
          fields: [
            "userId",
            "sharedAt",
          ],
        },
      ],
    }
  );

User.hasMany(
  PublicTrack,
  {
    foreignKey:
      "userId",

    onDelete:
      "CASCADE",
  }
);

PublicTrack.belongsTo(
  User,
  {
    foreignKey:
      "userId",
  }
);

FinishedHike.hasOne(
  PublicTrack,
  {
    foreignKey:
      "sourceHikeId",

    sourceKey:
      "id",

    onDelete:
      "CASCADE",
  }
);

PublicTrack.belongsTo(
  FinishedHike,
  {
    foreignKey:
      "sourceHikeId",

    targetKey:
      "id",
  }
);

module.exports =
  PublicTrack;
