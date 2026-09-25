const { HttpError } = require("../utils/errors");


const MAX_QUANTITY = 20;

const byId = (list = []) => new Map(list.map((item) => [item.id, item]));
const toNumber = (value) => Number(value) || 0;
const unique = (list = []) => [...new Set(list)];

function fail(message) {
  throw new HttpError(400, message);
}

function priceLine(menu, maps, item) {
  const product = maps.products.get(item.productId);

  if (!product) fail("An item in your cart is no longer on the menu.");
  if (product.available === false) fail(`${product.name} is currently unavailable.`);

  const quantity = Number(item.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    fail(`Choose between 1 and ${MAX_QUANTITY} of each item.`);
  }

  const base = product.prices?.[item.sizeId];

  if (base === undefined) fail(`Invalid size for ${product.name}.`);

  const sizeLabel =
    (menu.sizes || []).find((size) => size.id === item.sizeId)?.label ||
    item.sizeId;

  const line = {
    productId: product.id,
    name: product.name,
    category: product.category || "",
    image: product.image || "",
    sizeId: item.sizeId,
    sizeLabel,
    quantity,
    crustId: null,
    crustName: "",
    cheeseId: null,
    cheeseName: "",
    extraToppingIds: [],
    removedToppingIds: [],
    details: [],
    unitPrice: toNumber(base),
  };

  // Sides, desserts and drinks have no options.
  if (product.type !== "pizza") {
    line.lineTotal = line.unitPrice * quantity;
    return line;
  }

  const defaultCrust =
    [...maps.crusts.values()].find((crust) => toNumber(crust.extraPrice) === 0) ||
    [...maps.crusts.values()][0];

  const crust = item.crustId ? maps.crusts.get(item.crustId) : defaultCrust;

  if (!crust) fail("Invalid crust choice.");

  const defaultCheese = maps.cheeses.get(product.defaultCheese);
  const cheese = item.cheeseId
    ? maps.cheeses.get(item.cheeseId)
    : defaultCheese || [...maps.cheeses.values()][0];

  if (!cheese) fail("Invalid cheese choice.");

  const defaults = new Set(product.defaultToppings || []);
  const extraIds = unique(item.extraToppingIds);
  const removedIds = unique(item.removedToppingIds);

  let toppingsTotal = 0;

  for (const id of extraIds) {
    const topping = maps.toppings.get(id);

    if (!topping || defaults.has(id)) fail(`Invalid topping on ${product.name}.`);
    if (topping.available === false) fail(`${topping.name} is unavailable.`);

    toppingsTotal += toNumber(topping.price);
    line.details.push(`+ ${topping.name}`);
  }

  for (const id of removedIds) {
    const topping = maps.toppings.get(id);

    if (!topping || !defaults.has(id)) fail(`Invalid topping on ${product.name}.`);

    toppingsTotal -= toNumber(topping.price);
    line.details.push(`- ${topping.name}`);
  }

  const cheeseDifference =
    toNumber(cheese.extraPrice) - toNumber(defaultCheese?.extraPrice);

  line.crustId = crust.id;
  line.crustName = crust.name;
  line.cheeseId = cheese.id;
  line.cheeseName = cheese.name;
  line.extraToppingIds = extraIds;
  line.removedToppingIds = removedIds;
  line.details = [
    crust.name,
    cheese.id !== product.defaultCheese ? cheese.name : null,
    ...line.details,
  ].filter(Boolean);

  line.unitPrice = Math.max(
    0,
    toNumber(base) + toNumber(crust.extraPrice) + cheeseDifference + toppingsTotal
  );
  line.lineTotal = line.unitPrice * quantity;

  return line;
}

// menu: { sizes, products, options: { crusts, cheeses, toppings } }
// items: [{ productId, sizeId, quantity, crustId?, cheeseId?,
//           extraToppingIds?, removedToppingIds? }]
function priceCart(menu, items, deliveryFee, options = {}) {
  if (!Array.isArray(items) || items.length === 0) fail("Your cart is empty.");

  const maps = {
    products: byId(menu.products),
    crusts: byId(menu.options?.crusts),
    cheeses: byId(menu.options?.cheeses),
    toppings: byId(menu.options?.toppings),
  };

  const lines = items.map((item) => priceLine(menu, maps, item));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  const fee = toNumber(deliveryFee);

  const freeDeliveryApplies =
    options.freeDeliveryEnabled === true &&
    Number(options.freeDeliveryMin) > 0 &&
    subtotal >= Number(options.freeDeliveryMin);

  const appliedFee = freeDeliveryApplies ? 0 : fee;

  return {
    lines,
    subtotal,
    deliveryFee: appliedFee,
    freeDelivery: freeDeliveryApplies,
    total: subtotal + appliedFee,
  };
}
module.exports = { priceCart, MAX_QUANTITY };
