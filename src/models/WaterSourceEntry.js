const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const WaterSourceEntry = sequelize.define(
  "WaterSourceEntry",
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

    sourceType: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    flowRating: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    lastConfirmedDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    potabilityNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "water_source_entries",
    timestamps: true,
  }
);

User.hasMany(WaterSourceEntry, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

WaterSourceEntry.belongsTo(User, {
  foreignKey: "userId",
});

module.exports = WaterSourceEntry;