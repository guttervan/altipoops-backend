const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

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
    },

    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
    },

    elevation: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    terrainType: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    distanceFromWater: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    distanceFromTrail: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    distanceFromCamp: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
  },
  {
    tableName: "cathole_entries",
    timestamps: true,
  }
);

// One user can have many cathole entries.
User.hasMany(CatholeEntry, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

// Every cathole entry belongs to one user.
CatholeEntry.belongsTo(User, {
  foreignKey: "userId",
});

module.exports = CatholeEntry;