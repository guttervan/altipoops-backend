const {
  DataTypes,
} = require("sequelize");

const sequelize = require(
  "../config/database"
);

const NatureObservation =
  sequelize.define(
    "NatureObservation",
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

      category: {
        type:
          DataTypes.STRING(30),
        allowNull: false,
        defaultValue:
          "unknown",
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

      summary: {
        type:
          DataTypes.TEXT,
        allowNull: true,
      },

      keyTraits: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      lookalikes: {
        type:
          DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      safetyNote: {
        type:
          DataTypes.TEXT,
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

      photoUrl: {
        type:
          DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName:
        "nature_observations",

      timestamps: true,
    }
  );

module.exports =
  NatureObservation;