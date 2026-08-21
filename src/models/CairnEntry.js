const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const CairnEntry = sequelize.define(
  "CairnEntry",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    photoUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [[
          "legit",
          "questionable",
          "absurd",
          "monster",
          "summit",
        ]],
      },
    },

    hikeTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    collectedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    elevationFeet: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      validate: {
        min: -90,
        max: 90,
      },
    },

    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      validate: {
        min: -180,
        max: 180,
      },
    },

    locationMode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "private",
      validate: {
        isIn: [[
          "private",
          "corridor",
          "masked",
          "generalized",
        ]],
      },
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isPublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "cairn_entries",
    timestamps: true,
  }
);

User.hasMany(CairnEntry, {
  foreignKey: "userId",
  as: "cairns",
  onDelete: "CASCADE",
});

CairnEntry.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

module.exports = CairnEntry;
