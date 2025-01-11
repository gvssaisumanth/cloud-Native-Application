const db = require("../config/db");
const UserModel = require("../models/user");
const AssignmentModel = require("../models/assignments");
const SubmissionModel = require("../models/submissions");
const seedUsers = require("./databaseSeeder");
const logger = require("../utilities/logWriter");
async function authenticateDatabase() {
  return await db.authenticate();
}
const models = {
  User: UserModel,
  Assignment: AssignmentModel,
  Submission: SubmissionModel,
};

models.User.hasMany(models.Assignment, {
  foreignKey: "user_id",
  as: "assignments",
});

models.Assignment.hasMany(models.Submission, {
  foreignKey: "assignmentId",
  as: "submissions",
});

models.Submission.belongsTo(models.Assignment, {
  foreignKey: "assignmentId",
  as: "assignment",
});

db.sync()
  .then(() => {
    console.log("All Tables are created successfully!");
    logger.info("Tables are Created Successfully.");
    return seedUsers();
  })
  .catch((error) => {
    console.log("Unable to create tables : ", `${error}`);
    logger.info(`Tables failed to create ${error}`);
  });

module.exports = {
  authenticateDatabase,
  models,
};
