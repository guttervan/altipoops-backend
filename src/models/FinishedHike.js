const {
  DataTypes,
} = require("sequelize");

const sequelize =
  require("../config/database");

const User =
  require("./User");

const FinishedHike =
  sequelize.define(
    "FinishedHike",
    {
      id: {
        type:
          DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },

      routeKey: {
        type:
          DataTypes.STRING,
        allowNull: false,
      },

      routeTitle: {
        type:
          DataTypes.STRING,
        allowNull: false,
      },

      routeSavedAt: {
        type:
          DataTypes.DATE,
        allowNull: true,
      },

      routeEntry: {
        type:
          DataTypes.JSONB,
        allowNull: true,
      },

      routeCoordinates: {
        type:
          DataTypes.JSONB,
        allowNull: true,
      },

      startedAt: {
        type:
          DataTypes.DATE,
        allowNull: false,
      },

      endedAt: {
        type:
          DataTypes.DATE,
        allowNull: false,
      },

      expectedReturn: {
        type:
          DataTypes.DATE,
        allowNull: true,
      },

      distanceMiles: {
        type:
          DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },

      durationSeconds: {
        type:
          DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      movingDurationSeconds: {
        type:
          DataTypes.INTEGER,
        allowNull: true,
      },

      averagePaceMinutesPerMile: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      elevationGainFeet: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      breadcrumbPoints: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      offRouteEvents: {
        type:
          DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      maxOffRouteFeet: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      checkInCount: {
        type:
          DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      contact: {
        type:
          DataTypes.TEXT,
        allowNull: true,
      },

      vehicle: {
        type:
          DataTypes.TEXT,
        allowNull: true,
      },

      notes: {
        type:
          DataTypes.TEXT,
        allowNull: true,
      },

      waypoints: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      safetyTimeline: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      weatherLog: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      conditionChecks: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      journalSummary: {
        type:
          DataTypes.TEXT,
        allowNull: true,
      },

      bestMomentId: {
        type:
          DataTypes.STRING,
        allowNull: true,
      },

      isJournalPrivate: {
        type:
          DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      postHikeQuality: {
        type:
          DataTypes.JSONB,
        allowNull: true,
      },

      correctionReview: {
        type:
          DataTypes.JSONB,
        allowNull: true,
      },

      savedHikeVerification: {
        type:
          DataTypes.JSONB,
        allowNull: true,
      },

      savedHikeRepairHistory: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      tableName:
        "finished_hikes",

      timestamps: true,

      indexes: [
        {
          fields: [
            "userId",
            "endedAt",
          ],
        },

        {
          fields: [
            "userId",
            "routeKey",
          ],
        },
      ],
    }
  );

User.hasMany(
  FinishedHike,
  {
    foreignKey:
      "userId",

    onDelete:
      "CASCADE",
  }
);

FinishedHike.belongsTo(
  User,
  {
    foreignKey:
      "userId",
  }
);

module.exports =
  FinishedHike;