// An error that carries an HTTP status. Messages of errors below 500 are safe
// to show to the customer.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

module.exports = { HttpError };
