const express = require("express");
const router = express.Router();
const userAuth = require("../utilities/userAuth");
const AssignmentModel = require("../models/assignments");
const SubmissionModel = require("../models/submissions");
const validateAssignmentData = require("../utilities/validateAssignmentData");
const validateSubmissionData = require("../utilities/validateSubmissionData");
const client = require("../utilities/stasd");
const logger = require("../utilities/logWriter");
const AWS = require("aws-sdk");

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.get("/v1/assignments", async (req, res) => {
  client.increment("GET.v1.assignments");
  if (Object.keys(req.query).length > 0 || Object.keys(req.body).length > 0) {
    logger.info(`Params not valid.`);
    return res.status(400).send({
      Status: 400,
      Message: "Unexpected query parameters or body content.",
    });
  }

  try {
    let auth_header = req.headers.authorization;
    let userDetails = await userAuth.userAuth(auth_header, res);

    if (userDetails) {
      userDetail = userDetails;
      let passwordCheck = await userAuth.isPasswordSame(
        userDetails.passwordFromHeader,
        userDetail.password
      );
      if (passwordCheck) {
        const assignments = await AssignmentModel.findAll({
          attributes: [
            "id",
            "name",
            "points",
            "num_of_attempts",
            "deadline",
            "assignment_created",
            "assignment_updated",
          ],
          order: [["assignment_created", "DESC"]],
        });

        res.send(assignments);
      } else {
        logger.info(
          `Authentication failed, Auth token is not provided for the user.`
        );
        return res.status(401).json({ message: "" });
      }
    } else {
      logger.info(
        `Authentication failed, Auth token is not provided for the user.`
      );
      return res.status(401).json({ message: "" });
    }
  } catch (error) {
    console.error(error);
    logger.info(`Database is down or tables are deleted`);
    res.status(503).send().json("Database is down or tables are deleted");
  }
});

router.post("/v1/assignments", isContentTypeJSON, async (req, res) => {
  client.increment("POST.v1.assignments");
  if (Object.keys(req.query).length > 0) {
    logger.info(`Params not valid.`);
    return res
      .status(400)
      .send({
        Status: 400,
      })
      .json({ Message: "Unexpected query parameters" });
  }
  try {
    let auth_header = req.headers.authorization;
    let userDetails = await userAuth.userAuth(auth_header, res);

    if (userDetails) {
      userDetail = userDetails;
      let passwordCheck = await userAuth.isPasswordSame(
        userDetails.passwordFromHeader,
        userDetail.password
      );
      if (passwordCheck) {
        const assignmentData = req.body;

        const validationError = validateAssignmentData(assignmentData);

        if (validationError) {
          logger.info(`Request body is not valid.`);
          return res.status(400).json({ message: validationError });
        }

        assignmentData.user_id = userDetail.id;

        const newAssignment = await AssignmentModel.create(assignmentData);
        logger.info(
          `Created a new Assignment with assignmentId: ${newAssignment.user_id}.`
        );
        return res.status(201).json(newAssignment);
      } else {
        logger.info(
          `Authentication failed , Username or Password is Incorrect to create a product.`
        );
        return res.status(401).json({ message: "Password incorrect" });
      }
    } else {
      logger.info(
        `Authentication failed , Username or Password is Incorrect to create a product.`
      );
      return res.status(401).json({ message: "Authentication failed" });
    }
  } catch (error) {
    console.log(error);
    logger.info(`Database is down or tables are deleted`);
    res.status(503).send().json("Database is down or tables are deleted");
  }
});

const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

router.get("/v1/assignments/:id", async (req, res) => {
  client.increment("GET.v1.assignments.id");
  if (Object.keys(req.query).length > 0 || Object.keys(req.body).length > 0) {
    logger.info(`Params not valid.`);
    return res.status(400).send({
      Status: 400,
      Message: "Unexpected query parameters or body content.",
    });
  }
  try {
    let auth_header = req.headers.authorization;
    let userDetails = await userAuth.userAuth(auth_header, res);

    if (userDetails) {
      let userID = userDetails.id;
      userDetail = userDetails;
      let passwordCheck = await userAuth.isPasswordSame(
        userDetails.passwordFromHeader,
        userDetail.password
      );
      if (passwordCheck) {
        const assignmentId = req.params.id;

        if (!uuidPattern.test(assignmentId)) {
          logger.info(`Invalid assignment ID format`);
          return res
            .status(400)
            .json({ Status: 400, Message: "Invalid assignment ID format" });
        }
        const assignment = await AssignmentModel.findOne({
          attributes: [
            "id",
            "name",
            "points",
            "num_of_attempts",
            "deadline",
            "assignment_created",
            "assignment_updated",
            "user_id",
          ],
          where: {
            id: assignmentId,
          },
        });
        if (!assignment) {
          logger.info(
            `Assignment info with assignmemnt_id: ${assignmentId} does not exist.`
          );
          return res
            .status(404)
            .json({ Status: 404, Message: "Assignment not found" });
        }
        // const hasPermission = assignment.user_id === userID ? true : false;
        // if (!hasPermission) {
        //   return res
        //     .status(403)
        //     .json({ Status: 403, Message: "Permission denied" });
        // }
        res.json(assignment);
      } else {
        logger.info(`Authentication failed, Password or user name is wrong.`);
        return res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      logger.info(`Authentication failed, Password or username is wrong.`);
      return res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    console.error(error);
    logger.info(`Database is down or tables are deleted.`);
    res
      .status(503)
      .send()
      .json({ message: "Database is down or tables are deleted" });
  }
});

router.put("/v1/assignments/:id", isContentTypeJSON, async (req, res) => {
  client.increment("PUT.v1.assignments.id");
  if (Object.keys(req.query).length > 0) {
    logger.info(`Params not valid.`);
    return res.status(400).send({
      Status: 400,
      Message: "Unexpected query parameters",
    });
  }
  try {
    let auth_header = req.headers.authorization;
    let userDetails = await userAuth.userAuth(auth_header, res);

    if (userDetails) {
      userDetail = userDetails;
      let userID = userDetails.id;
      let passwordCheck = await userAuth.isPasswordSame(
        userDetails.passwordFromHeader,
        userDetail.password
      );
      if (passwordCheck) {
        const assignmentId = req.params.id;
        const assignmentData = req.body;

        const validationError = validateAssignmentData(assignmentData);

        if (validationError) {
          logger.info(`Request body is not valid.`);
          return res.status(400).json({ message: validationError });
        }

        if (!uuidPattern.test(assignmentId)) {
          logger.info(`Assignment ID  ${assignmentId} is not valid.`);
          return res.status(400).json({
            Status: 400,
            Message: "Invalid assignment ID format",
          });
        }

        const existingAssignment = await AssignmentModel.findByPk(assignmentId);
        if (!existingAssignment) {
          logger.info(`Assignment with ID  ${assignmentId} is not found.`);
          return res
            .status(404)
            .json({ Status: 404, Message: "Assignment not found" });
        }
        const hasPermission =
          existingAssignment.user_id === userID ? true : false;
        if (!hasPermission) {
          logger.info(
            `Authorization failed, User doesn't have access to update (id: ${assignmentId}).`
          );
          return res
            .status(403)
            .json({ Status: 403, Message: "Permission denied" });
        }
        existingAssignment.set(assignmentData);
        await existingAssignment.save();
        logger.info(
          `Successfully Updated the assignment data for the assignmentId (id: ${assignmentId}).`
        );
        res.status(204).send();
      } else {
        logger.info(
          `Authentication failed , Username or Password is Incorrect to access the assignment (id: ${assignmentId}).`
        );
        return res.status(401).json({ message: "unauthorized" });
      }
    } else {
      logger.info(
        `Authentication failed , Username or Password is Incorrect to access the assignment (id: ${assignmentId}).`
      );
      return res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    console.error(error);
    logger.info(
      `Authorization failed, User doesn't have access to update (id: ${assignmentId}).`
    );
    res.status(503).send().json("Database is down or tables are deleted");
  }
});

router.delete("/v1/assignments/:id", async (req, res) => {
  client.increment("DELETE.v1.assignments.id");
  if (Object.keys(req.query).length > 0 || Object.keys(req.body).length > 0) {
    logger.info(`Params not valid.`);
    return res.status(400).send({
      Status: 400,
      Message: "Unexpected query parameters or body content.",
    });
  }

  try {
    const authHeader = req.headers.authorization;
    const userDetails = await userAuth.userAuth(authHeader, res);

    if (!userDetails) {
      logger.info(`Authentication failed, Password or username is wrong.`);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const assignmentId = req.params.id;

    let userID = userDetails.id;
    let passwordCheck = await userAuth.isPasswordSame(
      userDetails.passwordFromHeader,
      userDetails.password
    );

    if (!passwordCheck) {
      logger.info(`Authentication failed, Password or username is wrong.`);
      return res.status(401).json({ message: "Invalid password" });
    }

    if (!uuidPattern.test(assignmentId)) {
      logger.info(`Assignment ID  ${assignmentId} is not valid.`);
      return res.status(400).json({
        Status: 400,
        Message: "Invalid assignment ID format",
      });
    }

    const existingAssignment = await AssignmentModel.findByPk(assignmentId);

    if (!existingAssignment) {
      logger.info(`Assignment with ID  ${assignmentId} is not found.`);
      return res
        .status(404)
        .json({ Status: 404, Message: "Assignment not found" });
    }

    const hasPermission = existingAssignment.user_id === userID;

    if (!hasPermission) {
      logger.info(
        `Authorization failed, User doesn't have access to Delete (id: ${assignmentId}).`
      );
      return res
        .status(403)
        .json({ Status: 403, Message: "Permission denied" });
    }
    await existingAssignment.destroy();
    logger.info(`Assignment (id: ${assignmentId}) is updated successfully.`);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    logger.info(`Database is down or tables are deleted`);
    res.status(503).json({ message: "" });
  }
});

const snsClient = new AWS.SNS({
  apiVersion: "2010-03-31",
  region: "us-east-1",
});

router.post(
  "/v1/assignments/:id/submission",
  isContentTypeJSON,
  async (req, res) => {
    client.increment("POST.v1.assignments/:id/submission");

    if (Object.keys(req.query).length > 0) {
      logger.info("Unexpected query parameters");
      return res.status(400).json({ message: "Unexpected query parameters" });
    }
    try {
      let authHeader = req.headers.authorization;
      let userDetails = await userAuth.userAuth(authHeader, res);

      if (userDetails) {
        let passwordCheck = await userAuth.isPasswordSame(
          userDetails.passwordFromHeader,
          userDetails.password
        );

        if (passwordCheck) {
          const submissionData = req.body;
          const assignmentId = req.params.id;
          const validationError = validateSubmissionData(submissionData);

          if (validationError) {
            logger.info("Invalid submission data");
            return res.status(400).json({ message: validationError });
          }

          const assignment = await AssignmentModel.findOne({
            where: { id: assignmentId },
          });

          if (!assignment) {
            res.status(404).json({ error: "Assignment not found" });
            return;
          }

          const currentDateTime = new Date();
          if (currentDateTime > assignment.deadline) {
            res.status(400).json({
              error:
                "Submission deadline has passed. Please create assignment with deadline in the past and try to submit.",
            });
            return;
          }

          const submissions = await SubmissionModel.findAll({
            where: { assignmentId: assignmentId },
          });

          if (submissions.length >= assignment.num_of_attempts) {
            res
              .status(400)
              .json({ error: "Exceeded maximum number of retries." });
            return;
          }

          submissionData.assignmentId = assignmentId;
          submissionData.userEmail = userDetails.email;

          const newSubmission = await SubmissionModel.create(submissionData);
          logger.info(
            `Created a new submission for assignment ${assignmentId}`
          );

          // Publish message to SNS topic
          logger.info("new submission", newSubmission);
          const snsMessage = {
            url: newSubmission.submission_url,
            user: {
              email: userDetails.email,
            },
          };

          const topicArn = process.env.TOPIC_ARN;
          const snsParams = {
            Message: JSON.stringify(snsMessage),
            TopicArn: topicArn,
          };

          try {
            const snsResponse = await snsClient.publish(snsParams).promise();
            logger.info("Message published to SNS:", snsResponse.MessageId);
          } catch (error) {
            logger.error("Error publishing message to SNS:", error);
          }

          return res.status(201).json(newSubmission);
        } else {
          logger.info("Password incorrect");
          return res.status(401).json({ message: "Password incorrect" });
        }
      } else {
        logger.info("Authentication failed");
        return res.status(401).json({ message: "Authentication failed" });
      }
    } catch (error) {
      logger.error(error);
      logger.info("Database error or network issue");
      return res
        .status(503)
        .json({ message: "Database error or network issue" });
    }
  }
);

function isContentTypeJSON(req, res, next) {
  const contentType = req.headers["content-type"];

  if (contentType && contentType.includes("application/json")) {
    next();
  } else {
    res.status(400).send({ error: "Content-Type should be application/json" });
  }
}

module.exports = router;
