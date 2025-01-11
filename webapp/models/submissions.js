// models/submission.js
const { Sequelize, DataTypes } = require("sequelize");
const db = require("../config/db");

const Submission = db.define("Submission", {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  userEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  submission_url: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isUrl: true,
    },
  },
  submissionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  assignmentId: {
    // Foreign key
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "Assignments",
      key: "id",
    },
  },
});

module.exports = Submission;
