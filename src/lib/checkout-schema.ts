import { z } from "zod";

export const CartLinesSchema = z.array(z.object({ variantId: z.string().max(40), quantity: z.number().int().min(1).max(10) })).max(50);

export const QuoteRequest = z.object({
  lines: CartLinesSchema,
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
  discountCode: z.string().trim().max(40).optional().nullable(),
});

const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|GIR ?0AA)$/i;
const US_ZIP = /^\d{5}(-\d{4})?$/;

export const CustomerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(160),
    name: z.string().trim().min(2, "Enter your full name").max(120),
    phone: z.string().trim().max(30).optional().default(""),
    addressLine1: z.string().trim().min(3, "Enter your address").max(160),
    addressLine2: z.string().trim().max(160).optional().default(""),
    city: z.string().trim().min(2, "Enter your town or city").max(80),
    region: z.string().trim().max(80).optional().default(""),
    postcode: z.string().trim().max(12),
    country: z.enum(["GB", "US"]),
  })
  .superRefine((v, ctx) => {
    if (v.country === "GB" && !UK_POSTCODE.test(v.postcode))
      ctx.addIssue({ code: "custom", path: ["postcode"], message: "Enter a valid UK postcode" });
    if (v.country === "US" && !US_ZIP.test(v.postcode))
      ctx.addIssue({ code: "custom", path: ["postcode"], message: "Enter a valid ZIP code" });
    if (v.country === "US" && !/^[A-Za-z]{2}$/.test(v.region))
      ctx.addIssue({ code: "custom", path: ["region"], message: "Enter the 2-letter state code" });
  });

export const CheckoutRequest = QuoteRequest.extend({ customer: CustomerSchema, acceptTerms: z.literal(true) });
