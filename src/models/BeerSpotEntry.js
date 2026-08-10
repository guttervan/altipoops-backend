const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");
const Trip = require("./Trip");

const BeerSpotEntry = sequelize.define(
  "BeerSpotEntry",
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

    venueName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    spotType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "summit",
      validate: {
        isIn: [[
          "summit",
          "brewery",
          "taproom",
          "bar",
          "restaurant",
          "campsite",
          "other",
        ]],
      },
    },

    beerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    beerStyle: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5,
      },
    },

    postHikeStop: {
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
    tableName: "beer_spot_entries",
    timestamps: true,
  }
);

User.hasMany(BeerSpotEntry, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

BeerSpotEntry.belongsTo(User, {
  foreignKey: "userId",
});

Trip.hasMany(BeerSpotEntry, {
  foreignKey: "tripId",
  as: "beerSpots",
  onDelete: "SET NULL",
});

BeerSpotEntry.belongsTo(Trip, {
  foreignKey: "tripId",
  as: "trip",
});

module.exports = BeerSpotEntry;