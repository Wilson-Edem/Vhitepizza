const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { priceCart } = require("../services/pricing");

const menu = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../scripts/menu.json"), "utf8")
);

const FEE = 1500;

const suya = (extra = {}) => ({
  productId: "chicken-suya-pizza",
  sizeId: "large",
  quantity: 1,
  ...extra,
});

test("default pizza costs its listed size price plus delivery", () => {
  const result = priceCart(menu, [suya()], FEE);

  assert.equal(result.lines[0].unitPrice, 9500);
  assert.equal(result.subtotal, 9500);
  assert.equal(result.total, 11000);
});

test("worked example: stuffed crust, extra cheese, add mushrooms, remove onions", () => {
  const result = priceCart(
    menu,
    [
      suya({
        crustId: "cheese-stuffed-crust",
        cheeseId: "extra-cheese",
        extraToppingIds: ["mushrooms"],
        removedToppingIds: ["red-onions"],
      }),
    ],
    FEE
  );

  assert.equal(result.lines[0].unitPrice, 12300);
});

test("quantity multiplies the line", () => {
  const result = priceCart(menu, [suya({ quantity: 2 })], FEE);

  assert.equal(result.lines[0].lineTotal, 19000);
  assert.equal(result.total, 20500);
});

test("cheese is priced against the pizza's default cheese", () => {
  const pepperoni = { productId: "pepperoni-supreme", sizeId: "medium", quantity: 1 };

  assert.equal(priceCart(menu, [pepperoni], FEE).lines[0].unitPrice, 6800);
  assert.equal(
    priceCart(menu, [{ ...pepperoni, cheeseId: "mozzarella" }], FEE).lines[0].unitPrice,
    5800
  );
  assert.equal(
    priceCart(menu, [{ ...pepperoni, cheeseId: "cheddar-blend" }], FEE).lines[0].unitPrice,
    7000
  );
});

test("sides have no options and use the regular price", () => {
  const result = priceCart(
    menu,
    [{ productId: "suya-wings-6pcs", sizeId: "regular", quantity: 2 }],
    FEE
  );

  assert.equal(result.lines[0].lineTotal, 8000);
});

test("the browser cannot set its own prices", () => {
  const result = priceCart(menu, [suya({ price: 1, unitPrice: 1, total: 1 })], FEE);

  assert.equal(result.lines[0].unitPrice, 9500);
});

test("bad carts are rejected", () => {
  const bad = [
    [[], /empty/i],
    [[suya({ productId: "not-a-pizza" })], /no longer on the menu/i],
    [[suya({ sizeId: "giant" })], /invalid size/i],
    [[suya({ quantity: 0 })], /between 1 and 20/i],
    [[suya({ quantity: 21 })], /between 1 and 20/i],
    [[suya({ crustId: "nope" })], /crust/i],
    [[suya({ extraToppingIds: ["nope"] })], /invalid topping/i],
    [[suya({ extraToppingIds: ["chicken-suya"] })], /invalid topping/i],
    [[suya({ removedToppingIds: ["mushrooms"] })], /invalid topping/i],
  ];

  for (const [items, message] of bad) {
    assert.throws(() => priceCart(menu, items, FEE), message);
  }
});

test("unavailable products cannot be ordered", () => {
  const closed = JSON.parse(JSON.stringify(menu));

  closed.products.find((item) => item.id === "chicken-suya-pizza").available = false;

  assert.throws(() => priceCart(closed, [suya()], FEE), /unavailable/i);
});
