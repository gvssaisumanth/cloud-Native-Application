const { DataTypes, Sequelize } = require("sequelize");
const db = require("../config/db");
const User = require("../models/user");

const Assignment = db.define(
  "Assignment",
  {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    num_of_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    user_id: {
      type: Sequelize.UUID,
      allowNull: false,
      noUpdate: true,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    createdAt: "assignment_created",
    updatedAt: "assignment_updated",
  },
  {
    tableName: "Assignments",
  }
);

Assignment.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

module.exports = Assignment;
