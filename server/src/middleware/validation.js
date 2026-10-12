// Checks that :id in the URL is a positive integer, and stores it as a number in req.id
function validateIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: { message: 'Id must be a positive integer' } });
  }
  req.id = id;
  next();
}

module.exports = { validateIdParam };
