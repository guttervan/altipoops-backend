const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    homeRegion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    privacySetting: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "private",
    },
  },
  {
    tableName: "users",
    timestamps: true,
  }
);

module.exports = User;