const validator = require("validator");

function validateSubmissionData(data) {
  const allowedProperties = ["submission_url"];

  for (const property in data) {
    if (!allowedProperties.includes(property)) {
      return `Unexpected property: '${property}'`;
    }
  }
  if (
    !data.hasOwnProperty("submission_url") ||
    !validator.isURL(data.submission_url) ||
    ((url.protocol !== "http:" || url.protocol !== "https:") &&
      url.pathname.endsWith(".zip"))
  ) {
    return "Invalid or missing submission URL.";
  }

  return null;
}

module.exports = validateSubmissionData;
