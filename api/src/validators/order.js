const { z } = require("zod");
const { HttpError } = require("../utils/errors");
const { STATUSES } = require("../services/status");

const id = z.string().trim().min(1).max(80);

const cartItem = z.object({
  productId: id,
  sizeId: id,
  quantity: z.number().int().min(1).max(20),
  crustId: id.nullable().optional(),
  cheeseId: id.nullable().optional(),
  extraToppingIds: z.array(id).max(30).default([]),
  removedToppingIds: z.array(id).max(30).default([]),
});

const items = z.array(cartItem).min(1).max(40);

const address = z.object({
  formattedAddress: z.string().trim().min(5).max(250),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number."),
  landmark: z.string().trim().max(150).default(""),
  notes: z.string().trim().max(300).default(""),
  source: z.enum(["pin", "search", "manual"]).default("manual"),
});

const schemas = {
  quote: z.object({ items }),
  order: z.object({ items, address }),
  status: z.object({
    status: z.enum(STATUSES),
    reason: z.string().trim().max(200).default(""),
  }),
  reason: z.object({ reason: z.string().trim().max(200).default("") }),
  rider: z.object({ riderId: id }),
};

// Returns the cleaned body, or throws a 400 with a readable message.
function parse(schema, body) {
  const result = schema.safeParse(body || {});

  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.length ? `${issue.path.join(".")}: ` : "";

    throw new HttpError(400, `${field}${issue?.message || "Invalid request."}`);
  }

  return result.data;
}

module.exports = { schemas, parse };
