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
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
      set(value) {
        this.setDataValue(
          "email",
          typeof value === "string"
            ? value.trim().toLowerCase()
            : value
        );
      },
    },

    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    homeRegion: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [0, 100],
      },
    },

    privacySetting: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "private",
      validate: {
        isIn: [["private", "friends", "public"]],
      },
    },
  },
  {
    tableName: "users",
    timestamps: true,
  }
);

module.exports = User;