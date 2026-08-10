const {
  DataTypes,
} = require("sequelize");

const sequelize = require(
  "../config/database"
);

const BirdObservation =
  sequelize.define(
    "BirdObservation",
    {
      id: {
        type:
          DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      userId: {
        type:
          DataTypes.INTEGER,
        allowNull: false,
      },

      commonName: {
        type:
          DataTypes.STRING(255),
        allowNull: true,
      },

      scientificName: {
        type:
          DataTypes.STRING(255),
        allowNull: true,
      },

      confidence: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      notes: {
        type:
          DataTypes.TEXT,
        allowNull: true,
      },

      latitude: {
        type:
          DataTypes.DECIMAL(
            10,
            7
          ),
        allowNull: true,
      },

      longitude: {
        type:
          DataTypes.DECIMAL(
            10,
            7
          ),
        allowNull: true,
      },

      elevation: {
        type:
          DataTypes.FLOAT,
        allowNull: true,
      },

      elevationSource: {
        type:
          DataTypes.STRING(40),
        allowNull: true,
        defaultValue:
          "unknown",
      },

      audioUrl: {
        type:
          DataTypes.STRING(255),
        allowNull: true,
      },

      durationMs: {
        type:
          DataTypes.INTEGER,
        allowNull: true,
      },

      locationFiltered: {
        type:
          DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      alternateMatches: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      tableName:
        "bird_observations",

      timestamps: true,
    }
  );

module.exports =
  BirdObservation;