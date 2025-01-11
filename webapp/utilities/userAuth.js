const bcrypt = require("bcrypt");
const User = require("../models/user");
const validator = require("email-validator");
const logger = require("../utilities/logWriter");

async function userAuth(auth_header, res) {
  if (!auth_header) {
    res
      .status(401)
      .send({ Status: 401, Message: "Please provide an Auth token." });
    return;
  }

  const [username, password] = Buffer.from(
    auth_header.replace("Basic ", ""),
    "base64"
  )
    .toString("utf8")
    .split(":");

  if (!username.trim() || !password) {
    res
      .status(401)
      .send({ Status: 401, Message: "Username or Password is Invalid." });
    return;
  }

  if (validator.validate(username) && password) {
    const userDetails = await getUserDetails(username);
    if (userDetails) {
      return {
        ...userDetails.dataValues,
        passwordFromHeader: password,
      };
    }
  }
}

async function getUserDetails(user_name) {
  try {
    const user = await User.findOne({ where: { email: user_name } });
    return user;
  } catch (error) {
    logger.error(`${error}`);
    console.error("Failed to retrieve data:", error);
    throw error;
  }
}

isPasswordSame = function (user_pass, result) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(user_pass, result, function (err, same) {
      if (err) {
        logger.error(`${error}`);
        reject(console.log(err));
      } else {
        resolve(same);
      }
    });
  });
};

module.exports = {
  userAuth,
  isPasswordSame,
  getUserDetails,
};
