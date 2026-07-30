function validateEntryId(request, response, next) {
  const entryId = Number(request.params.id);

  if (!Number.isInteger(entryId) || entryId <= 0) {
    return response.status(400).json({
      message: "Entry ID must be a positive whole number.",
    });
  }

  request.params.id = entryId;

  next();
}

module.exports = validateEntryId;