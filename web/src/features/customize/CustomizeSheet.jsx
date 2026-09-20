import { useEffect, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { calcUnitPrice, formatMoney, getDefaultSelection } from "../../pricing";
import "./customize.css";

const TOPPING_GROUPS = [
  ["meat", "Meat"],
  ["vegetable", "Vegetables"],
  ["sauce", "Sauces"],
];

const signed = (amount) =>
  amount === 0
    ? "Included"
    : `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount))}`;

export default function CustomizeSheet({
  product,
  sizes,
  options,
  imageSlot,
  onClose,
  onAdd,
}) {
  const crusts = options.crusts || [];
  const cheeses = options.cheeses || [];
  const toppings = options.toppings || [];

  const [selection, setSelection] = useState(() =>
    getDefaultSelection(product, options, sizes[0]?.id)
  );
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const defaults = new Set(product.defaultToppings || []);
  const picked = new Set(selection.toppingIds);
  const unitPrice = calcUnitPrice(product, options, selection);
  const defaultCheese = cheeses.find((item) => item.id === product.defaultCheese);

  const choose = (key, value) =>
    setSelection((current) => ({ ...current, [key]: value }));

  const toggleTopping = (id) =>
    setSelection((current) => ({
      ...current,
      toppingIds: current.toppingIds.includes(id)
        ? current.toppingIds.filter((item) => item !== id)
        : [...current.toppingIds, id],
    }));

  const groups = [
    ...TOPPING_GROUPS.map(([id, label]) => ({
      id,
      label,
      items: toppings.filter((item) => item.group === id),
    })),
    {
      id: "other",
      label: "Other",
      items: toppings.filter(
        (item) => !TOPPING_GROUPS.some(([id]) => id === item.group)
      ),
    },
  ].filter((group) => group.items.length);

  const handleAdd = () => {
    const size = sizes.find((item) => item.id === selection.sizeId) || sizes[0];

    if (!size) return;

    const crust = crusts.find((item) => item.id === selection.crustId);
    const cheese = cheeses.find((item) => item.id === selection.cheeseId);
    const added = toppings.filter(
      (item) => picked.has(item.id) && !defaults.has(item.id)
    );
    const removed = toppings.filter(
      (item) => !picked.has(item.id) && defaults.has(item.id)
    );

    const details = [
      crust?.name,
      cheese && cheese.id !== product.defaultCheese ? cheese.name : null,
      ...added.map((item) => `+ ${item.name}`),
      ...removed.map((item) => `− ${item.name}`),
    ].filter(Boolean);

    onAdd({
      id: [
        product.id,
        size.id,
        crust?.id,
        cheese?.id,
        added.map((item) => item.id).sort().join("+"),
        removed.map((item) => item.id).sort().join("+"),
      ].join("|"),
      productId: product.id,
      name: product.name,
      image: product.image,
      category: product.category,
      sizeId: size.id,
      sizeLabel: size.label,
      price: unitPrice,
      quantity,
      details,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="product-modal customize-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${product.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="modal-image">{imageSlot}</div>

        <div className="modal-content">
          <h2>{product.name}</h2>
          <p>{product.description}</p>

          <div className="option-block">
            <h4>Size</h4>

            <div className="option-grid">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  className={`option-chip ${
                    selection.sizeId === size.id ? "selected" : ""
                  }`}
                  aria-pressed={selection.sizeId === size.id}
                  onClick={() => choose("sizeId", size.id)}
                >
                  <strong>{size.label}</strong>
                  <small>{formatMoney(size.price)}</small>
                </button>
              ))}
            </div>
          </div>

          {crusts.length > 0 && (
            <div className="option-block">
              <h4>Crust</h4>

              <div className="option-grid">
                {crusts.map((crust) => (
                  <button
                    key={crust.id}
                    className={`option-chip ${
                      selection.crustId === crust.id ? "selected" : ""
                    }`}
                    aria-pressed={selection.crustId === crust.id}
                    onClick={() => choose("crustId", crust.id)}
                  >
                    <strong>{crust.name}</strong>
                    <small>{signed(Number(crust.extraPrice || 0))}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cheeses.length > 0 && (
            <div className="option-block">
              <h4>Cheese</h4>

              <div className="option-grid">
                {cheeses.map((cheese) => (
                  <button
                    key={cheese.id}
                    className={`option-chip ${
                      selection.cheeseId === cheese.id ? "selected" : ""
                    }`}
                    aria-pressed={selection.cheeseId === cheese.id}
                    onClick={() => choose("cheeseId", cheese.id)}
                  >
                    <strong>{cheese.name}</strong>
                    <small>
                      {signed(
                        Number(cheese.extraPrice || 0) -
                          Number(defaultCheese?.extraPrice || 0)
                      )}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {groups.map((group) => (
            <div className="option-block" key={group.id}>
              <h4>{group.label}</h4>

              <div className="option-scroll">
                {group.items.map((topping) => {
                  const isPicked = picked.has(topping.id);
                  const isDefault = defaults.has(topping.id);
                  const price = formatMoney(topping.price);

                  const note = isPicked
                    ? isDefault
                      ? "Included"
                      : `+${price}`
                    : isDefault
                      ? `Removed −${price}`
                      : `+${price}`;

                  return (
                    <button
                      key={topping.id}
                      className={`option-chip ${isPicked ? "selected" : ""} ${
                        !isPicked && isDefault ? "removed" : ""
                      }`}
                      aria-pressed={isPicked}
                      onClick={() => toggleTopping(topping.id)}
                    >
                      {isPicked && <Check className="chip-check" size={15} />}
                      <strong>{topping.name}</strong>
                      <small>{note}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="customize-footer">
            <div className="qty">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus size={16} />
              </button>

              <span>{quantity}</span>

              <button
                aria-label="Increase quantity"
                onClick={() => setQuantity((current) => Math.min(20, current + 1))}
              >
                <Plus size={16} />
              </button>
            </div>

            <button className="primary-button" onClick={handleAdd}>
              Add to Cart · {formatMoney(unitPrice * quantity)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
