const { HttpError } = require("../utils/errors");

const STATUS = {
  AWAITING_PAYMENT: "awaiting_payment",
  PLACED: "placed",
  PENDING_APPROVAL: "pending_approval",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

// Who is allowed to move an order from one status to another.
// "system" means the server itself (payment confirmed, timers).
const TRANSITIONS = {
  awaiting_payment: {
    placed: ["system"],
    cancelled: ["customer", "admin", "system"],
  },
  placed: {
    confirmed: ["system"],
    pending_approval: ["system"],
    cancelled: ["customer", "admin"],
  },
  pending_approval: {
    confirmed: ["admin"],
    cancelled: ["customer", "admin"],
  },
  confirmed: {
    preparing: ["system", "admin"],
    cancelled: ["customer", "admin"],
  },
  preparing: {
    ready: ["kitchen", "admin"],
    cancelled: ["admin"],
  },
  ready: {
    out_for_delivery: ["rider", "admin"],
    cancelled: ["admin"],
  },
  out_for_delivery: {
    delivered: ["rider", "admin"],
    cancelled: ["admin"],
  },
  delivered: {},
  cancelled: {},
};

const STATUSES = Object.values(STATUS);

const isTerminal = (status) =>
  Object.keys(TRANSITIONS[status] || {}).length === 0;

function canTransition(from, to, role) {
  return Boolean(TRANSITIONS[from]?.[to]?.includes(role));
}

// Throws a clear error when a move is not allowed.
function assertTransition(from, to, role) {
  if (!STATUSES.includes(to)) {
    throw new HttpError(400, "Unknown order status.");
  }

  if (isTerminal(from)) {
    throw new HttpError(409, "This order is already finished.");
  }

  if (!TRANSITIONS[from]?.[to]) {
    throw new HttpError(409, `An order cannot move from ${from} to ${to}.`);
  }

  if (!canTransition(from, to, role)) {
    throw new HttpError(403, "You are not allowed to make this change.");
  }
}

module.exports = {
  STATUS,
  STATUSES,
  TRANSITIONS,
  isTerminal,
  canTransition,
  assertTransition,
};
