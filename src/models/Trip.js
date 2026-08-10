const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Trip = sequelize.define(
  "Trip",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 120],
      },
    },

    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
      },
    },

    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
      },
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "trips",
    timestamps: true,
  }
);

User.hasMany(Trip, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});

Trip.belongsTo(User, {
  foreignKey: "userId",
});

module.exports = Trip;