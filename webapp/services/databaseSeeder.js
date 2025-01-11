const UserModel = require("../models/user");
const readCSV = require("../utilities/csvUtil");
const path = require("path");
const logger = require("../utilities/logWriter");

const filePath = path.join(__dirname, "../opt/users.csv");
const bcrypt = require("bcrypt");

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}
async function seedUsersFromCSV() {
  try {
    const users = await readCSV(filePath);

    for (const user of users) {
      const existingUser = await UserModel.findOne({
        where: { email: user.email },
      });

      if (!existingUser) {
        user.password = await hashPassword(user.password);

        delete user.account_created;
        delete user.account_updated;
        await UserModel.create(user);
      }
    }

    console.log("CSV data inserted successfully!");
    logger.info(`Tables are created successfully in the database.`);
  } catch (error) {
    console.error("Error inserting CSV data:", error);
    logger.error(`Unable to create tables in the database, ${error}.`);
  }
}

module.exports = seedUsersFromCSV;
