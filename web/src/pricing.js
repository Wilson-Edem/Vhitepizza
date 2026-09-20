// Price PREVIEW for the browser. The server recalculates every price itself
// when an order is created, so nothing here is trusted for real payments.

export const formatMoney = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG")}`;

export const getDefaultSelection = (product, options, sizeId) => {
  const crusts = options.crusts || [];
  const cheeses = options.cheeses || [];

  return {
    sizeId,
    crustId:
      (crusts.find((crust) => Number(crust.extraPrice) === 0) || crusts[0])
        ?.id ?? null,
    cheeseId: product.defaultCheese || cheeses[0]?.id || null,
    toppingIds: [...(product.defaultToppings || [])],
  };
};

export const calcUnitPrice = (product, options, selection) => {
  const base = Number(product.prices?.[selection.sizeId] ?? 0);

  const crust = Number(
    (options.crusts || []).find((item) => item.id === selection.crustId)
      ?.extraPrice ?? 0
  );

  const cheeses = options.cheeses || [];
  const chosen = cheeses.find((item) => item.id === selection.cheeseId);
  const standard = cheeses.find((item) => item.id === product.defaultCheese);
  const cheese =
    Number(chosen?.extraPrice ?? 0) - Number(standard?.extraPrice ?? 0);

  const defaults = new Set(product.defaultToppings || []);
  const picked = new Set(selection.toppingIds);
  let toppings = 0;

  for (const topping of options.toppings || []) {
    const price = Number(topping.price || 0);

    if (picked.has(topping.id) && !defaults.has(topping.id)) toppings += price;
    if (!picked.has(topping.id) && defaults.has(topping.id)) toppings -= price;
  }

  return Math.max(0, base + crust + cheese + toppings);
};
