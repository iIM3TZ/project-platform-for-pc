// Unknown /api routes
function notFound(req, res) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

// Last middleware: any error thrown in a route ends up here.
// Express 5 passes errors from async handlers automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong' : err.message;
  res.status(status).json({ error: { message } });
}

module.exports = { notFound, errorHandler };
