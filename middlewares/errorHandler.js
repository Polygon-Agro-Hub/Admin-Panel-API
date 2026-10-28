module.exports = (err, req, res, next) => {
  console.error(`[${err.code || "ERROR"}] ${err.message}`, err.transactionId || "");
  res.status(err.status || 500).json({
    code: err.code || "INTERNAL_ERROR",
    message: err.status && err.status < 500 ? err.message : "An error occurred.",
    transactionId: err.transactionId,
    details: err.details,
  });
};