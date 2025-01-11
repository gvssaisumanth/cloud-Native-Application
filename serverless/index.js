import AWS from "aws-sdk";
import { Storage } from "@google-cloud/storage";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import mailgunTransport from "nodemailer-mailgun-transport";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const dynamoDBClient = new AWS.DynamoDB.DocumentClient();

if (
  !process.env.GCS_SERVICE_ACCOUNT_KEY ||
  !process.env.GOOGLE_CLIENT_MAIL ||
  !process.env.GOOGLE_PROJECT_ID ||
  !process.env.GCS_BUCKET_NAME ||
  !process.env.MAILGUN_API_KEY ||
  !process.env.MAILGUN_DOMAIN ||
  !process.env.DYNAMODB_TABLE_NAME
) {
  throw new Error("Missing required environment variables");
}

const gcsStorage = initializeGCS();

export async function handler(event) {
  var snsData;
  try {
    snsData = parseSNSMessage(event);
    console.log(snsData);
    const fileBuffer = await downloadFile(snsData.url);
    const filePath = await uploadToGCS(fileBuffer, snsData.user.email); // Capture the file path
    console.log("File uploaded to:", filePath);
    await notifyUser(
      snsData.user.email,
      "Download Complete",
      "Your submission has been downloaded and stored.",
      filePath
    );
    await logToDynamoDB(snsData.user.email, "Success");
    return response(200, "Submission processed successfully.");
  } catch (error) {
    console.error("Error:", error);

    let errorMessage = error.message || "An unknown error occurred"; // Fallback error message
    if (snsData && snsData.user && snsData.user.email) {
      await notifyUser(
        snsData.user.email,
        "Processing Error",
        `There was an error processing your submission: ${errorMessage}`
      );
      await logToDynamoDB(snsData.user.email, "Failed");
    }
    return response(500, `Error processing submission: ${errorMessage}`);
  }
}

function initializeGCS() {
  const cred = Buffer.from(
    process.env.GCS_SERVICE_ACCOUNT_KEY,
    "base64"
  ).toString("ascii");
  const gcpPrivateKey = JSON.parse(cred).private_key.replace(/\\n/g, "\n");

  const credentials = {
    client_email: process.env.GOOGLE_CLIENT_MAIL,
    private_key: gcpPrivateKey,
  };

  console.log("gccp", credentials);

  return new Storage({
    credentials: credentials,
    projectId: process.env.GOOGLE_PROJECT_ID,
  });
}

function parseSNSMessage(event) {
  const record = event.Records[0].Sns;
  const message = JSON.parse(record.Message);
  return message;
}

async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.buffer();
}

async function uploadToGCS(fileBuffer, userEmail) {
  const fileName = `submissions/${userEmail}/${Date.now()}-submission.zip`;
  const gcsFile = gcsStorage.bucket(process.env.GCS_BUCKET_NAME).file(fileName);
  await gcsFile.save(fileBuffer);
  return fileName;
}

async function notifyUser(to, subject, message, filePath = "") {
  const additionalMessage = filePath
    ? `\n\nFile path in GCS Bucket: ${filePath}`
    : "";
  const fullMessage = `${message}${additionalMessage}`;

  const transporter = nodemailer.createTransport(
    mailgunTransport({
      auth: {
        api_key: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
      },
    })
  );

  const mailOptions = {
    from: "sumanth@demo.gvsss3.com",
    to: to,
    subject: subject,
    text: fullMessage,
  };

  await transporter.sendMail(mailOptions);
}

async function logToDynamoDB(userEmail, status) {
  const params = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Item: {
      id: uuidv4(),
      userEmail: userEmail,
      submissionTime: new Date().toISOString(),
      status: status,
    },
  };

  await dynamoDBClient.put(params).promise();
}

function response(statusCode, message) {
  return { statusCode, body: message };
}
