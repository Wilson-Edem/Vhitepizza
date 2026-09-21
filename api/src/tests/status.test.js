const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STATUSES,
  canTransition,
  assertTransition,
  isTerminal,
} = require("../services/status");

test("normal order follows the full path with the right people", () => {
  const path = [
    ["awaiting_payment", "placed", "system"],
    ["placed", "confirmed", "system"],
    ["confirmed", "preparing", "system"],
    ["preparing", "ready", "kitchen"],
    ["ready", "out_for_delivery", "rider"],
    ["out_for_delivery", "delivered", "rider"],
  ];

  for (const [from, to, role] of path) {
    assert.equal(canTransition(from, to, role), true, `${from} -> ${to}`);
  }
});

test("large orders wait for the admin", () => {
  assert.equal(canTransition("placed", "pending_approval", "system"), true);
  assert.equal(canTransition("pending_approval", "confirmed", "admin"), true);
  assert.equal(canTransition("pending_approval", "confirmed", "kitchen"), false);
  assert.equal(canTransition("pending_approval", "confirmed", "customer"), false);
});

test("customers can cancel only before preparing", () => {
  for (const from of ["awaiting_payment", "placed", "pending_approval", "confirmed"]) {
    assert.equal(canTransition(from, "cancelled", "customer"), true, from);
  }

  for (const from of ["preparing", "ready", "out_for_delivery"]) {
    assert.equal(canTransition(from, "cancelled", "customer"), false, from);
  }
});

test("admin can cancel any unfinished order", () => {
  for (const from of STATUSES.filter((status) => !isTerminal(status))) {
    assert.equal(canTransition(from, "cancelled", "admin"), true, from);
  }
});

test("each role can only do its own job", () => {
  assert.equal(canTransition("preparing", "ready", "rider"), false);
  assert.equal(canTransition("preparing", "ready", "customer"), false);
  assert.equal(canTransition("ready", "out_for_delivery", "kitchen"), false);
  assert.equal(canTransition("out_for_delivery", "delivered", "kitchen"), false);
  assert.equal(canTransition("awaiting_payment", "placed", "customer"), false);
  assert.equal(canTransition("placed", "confirmed", "kitchen"), false);
});

test("orders cannot skip steps or go backwards", () => {
  assert.equal(canTransition("placed", "preparing", "admin"), false);
  assert.equal(canTransition("preparing", "confirmed", "admin"), false);
  assert.equal(canTransition("ready", "delivered", "rider"), false);
});

test("finished orders cannot change", () => {
  assert.equal(isTerminal("delivered"), true);
  assert.equal(isTerminal("cancelled"), true);
  assert.throws(() => assertTransition("delivered", "cancelled", "admin"), /finished/i);
  assert.throws(() => assertTransition("cancelled", "placed", "system"), /finished/i);
});

test("assertTransition gives clear errors", () => {
  assert.throws(() => assertTransition("placed", "preparing", "admin"), /cannot move/i);
  assert.throws(() => assertTransition("preparing", "ready", "rider"), /not allowed/i);
  assert.throws(() => assertTransition("placed", "teleported", "admin"), /unknown/i);
  assert.doesNotThrow(() => assertTransition("preparing", "ready", "kitchen"));
});
