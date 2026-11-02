class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", transactionId, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.transactionId = transactionId;
    this.details = details;
  }
}
module.exports = AppError;