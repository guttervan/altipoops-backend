const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");
const Trip = require("./Trip");

const CatholeEntry = sequelize.define(
  "CatholeEntry",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: -90,
        max: 90,
      },
    },

    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: -180,
        max: 180,
      },
    },

    elevation: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    elevationSource: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isIn: [["usgs", "phone_gps", "manual", "unknown"]],
      },
    },

    terrainType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["forest", "desert", "alpine", "snow", "other"]],
      },
    },

    method: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["cathole", "wag_bag", "groover"]],
      },
    },

    distanceFromWater: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    distanceFromTrail: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    distanceFromCamp: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    depthConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    tpPackedOut: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    photoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tripId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "cathole_entries",
    timestamps: true,
  }
);

User.hasMany(CatholeEntry, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

CatholeEntry.belongsTo(User, {
  foreignKey: "userId",
});

Trip.hasMany(CatholeEntry, {
  foreignKey: "tripId",
  as: "catholes",
  onDelete: "SET NULL",
});

CatholeEntry.belongsTo(Trip, {
  foreignKey: "tripId",
  as: "trip",
});

module.exports = CatholeEntry;