function validateAssignmentData(data) {
  const allowedProperties = ["name", "points", "num_of_attempts", "deadline"];

  for (const property in data) {
    if (!allowedProperties.includes(property)) {
      return `Unexpected property: '${property}'`;
    }
  }

  if (
    !data.hasOwnProperty("name") ||
    typeof data.name !== "string" ||
    data.name.trim() === ""
  ) {
    return "Name is required and should be a string.";
  }

  if (
    !data.hasOwnProperty("points") ||
    typeof data.points !== "number" ||
    data.points < 1 ||
    data.points > 10
  ) {
    return "Points should be a number between 1 and 10.";
  }

  if (
    !data.hasOwnProperty("num_of_attempts") ||
    !Number.isInteger(data.num_of_attempts) ||
    data.num_of_attempts <= 0
  ) {
    return "Number of attempts should be an integer.";
  }

  if (!data.hasOwnProperty("deadline") || typeof data.deadline !== "string") {
    return "Deadline is required and should be a string.";
  }

  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (!iso8601Regex.test(data.deadline)) {
    return "Deadline should be in ISO 8601 date-time format (YYYY-MM-DDTHH:mm:ss.sssZ).";
  }

  const deadlineDate = new Date(data.deadline);
  const currentDate = new Date();

  if (isNaN(deadlineDate.getTime()) || deadlineDate <= currentDate) {
    return "Deadline should be a valid date-time string and greater than today's date.";
  }

  return null;
}

module.exports = validateAssignmentData;
