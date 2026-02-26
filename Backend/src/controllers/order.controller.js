const crypto = require("node:crypto");
const { z } = require("zod");

const { getPrisma } = require("../db/prismaClient");
const { OrderStatus, OrderRequestType } = require("@prisma/client");
const { sendSuccess, sendError } = require("../utils/response");
const {
  roundMoney,
  toMoney,
  normalizeDiscountCode,
  isDiscountLive,
  calculateDiscountAmount,
} = require("../utils/discounts");

const FREE_SHIPPING_THRESHOLD = 5000;
const STANDARD_SHIPPING_FEE = 100;
const PAYMENT_FEES = {
  COD: 10,
};

const shippingSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  trackingNumber: z.string().optional(),
  awb: z.string().optional(),
  awbCode: z.string().optional(),
  courierName: z.string().optional(),
  trackingUrl: z.string().optional(),
  shiprocketOrderId: z.string().optional(),
  estimatedDelivery: z.string().optional(),
}).passthrough();

const discountInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    code: z.string().min(2).max(64).optional(),
  })
  .refine((value) => value.id || value.code, {
    message: "Discount id or code is required.",
  });

const createOrderSchema = z.object({
  paymentMethod: z.string().max(64).optional(),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    shippingFee: z.number().nonnegative(),
    paymentFee: z.number().nonnegative().optional(),
    discountAmount: z.number().nonnegative().optional(),
    discountCode: z.string().max(64).nullable().optional(),
    total: z.number().nonnegative(),
    currency: z.string().optional(),
  }),
  shipping: shippingSchema,
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        sku: z.string().optional(),
        name: z.string().min(1),
        price: z.number().nonnegative(),
        currency: z.string().optional(),
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
  discount: discountInputSchema.optional().nullable(),
});

const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  shipping: shippingSchema.partial().optional(),
});

const orderActionSchema = z.object({
  items: z.array(z.string().min(1)).min(1, "Select at least one item"),
  reason: z.string().trim().min(2, "Reason is required").max(200),
  comments: z.string().trim().max(1000).optional(),
  attachments: z.array(z.string().trim().min(1)).max(6).optional(),
});

const returnExchangeSchema = orderActionSchema.extend({
  bankDetails: z
    .object({
      accountName: z.string().trim().min(1, "Account holder name is required"),
      accountNumber: z.string().trim().min(4, "Account number is required"),
      ifsc: z.string().trim().min(4, "IFSC code is required"),
      bankName: z.string().trim().min(1, "Bank name is required"),
    })
    .optional(),
});

const createRazorpayOrderSchema = z.object({
  amount: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  receipt: z.string().max(64).optional(),
  notes: z.record(z.string()).optional(),
  order: createOrderSchema.optional(),
}).refine((payload) => payload.amount || payload.order, {
  message: "amount or order is required",
});

const confirmRazorpayCheckoutSchema = z.object({
  payment: z.object({
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  }),
  order: createOrderSchema,
});

const sanitizeOrder = (order) => {
  if (!order) return null;
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentMethod: order.paymentMethod,
    totals: order.totals,
    shipping: order.shipping,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    userId: order.userId,
  };
};

const sanitizeOrderRequest = (request) => {
  if (!request) return null;
  return {
    id: request.id,
    orderId: request.orderId,
    userId: request.userId,
    type: request.type,
    status: request.status,
    items: request.items,
    reason: request.reason,
    comments: request.comments,
    attachments: request.attachments,
    bankDetails: request.bankDetails,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    resolvedAt: request.resolvedAt,
  };
};

const toOrderLines = (order) => {
  const source = Array.isArray(order?.items) ? order.items : [];
  return source.map((item, index) => ({
    lineId:
      String(item?.id || "").trim() ||
      String(item?.sku || "").trim() ||
      `line-${index + 1}`,
    item,
  }));
};

const getRequestedLines = (order, selectedIds = []) => {
  const lines = toOrderLines(order);
  const normalizedTargets = Array.from(
    new Set(
      (Array.isArray(selectedIds) ? selectedIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  const selected = lines.filter((line) => normalizedTargets.includes(line.lineId));
  const unknownIds = normalizedTargets.filter(
    (target) => !selected.some((line) => line.lineId === target),
  );

  return { selected, unknownIds };
};

const findMyOrder = async (prisma, userId, orderId) =>
  prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
  });

const createOrderNumber = () => `ORD-${Date.now().toString(36).toUpperCase()}`;

const normalizePaymentMethod = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase();

const calculateSubtotalFromItems = (items = []) =>
  roundMoney(
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const price = toMoney(item?.price, 0);
      const quantity = Math.max(1, Number(item?.quantity || 0));
      return sum + price * quantity;
    }, 0),
  );

const calculateShippingFee = (subtotal) =>
  subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;

const calculatePaymentFee = (paymentMethod) =>
  toMoney(PAYMENT_FEES[normalizePaymentMethod(paymentMethod)] || 0, 0);

const buildDiscountSnapshot = (discount, amount) => ({
  id: discount.id,
  code: discount.code,
  name: discount.name || null,
  type: discount.type,
  value: toMoney(discount.value, 0),
  minSubtotal:
    discount.minSubtotal === null || discount.minSubtotal === undefined
      ? null
      : toMoney(discount.minSubtotal, 0),
  maxDiscount:
    discount.maxDiscount === null || discount.maxDiscount === undefined
      ? null
      : toMoney(discount.maxDiscount, 0),
  amount: toMoney(amount, 0),
});

const resolveAppliedDiscount = async (prisma, discountInput, subtotal) => {
  if (!discountInput || typeof discountInput !== "object") {
    return { discountAmount: 0, discount: null };
  }

  const requestedId = String(discountInput.id || "").trim();
  const requestedCode = normalizeDiscountCode(discountInput.code);
  if (!requestedId && !requestedCode) {
    return { discountAmount: 0, discount: null };
  }

  let discount = null;
  if (requestedId) {
    discount = await prisma.discount.findUnique({ where: { id: requestedId } });
  }
  if (!discount && requestedCode) {
    discount = await prisma.discount.findUnique({ where: { code: requestedCode } });
  }

  if (!discount) {
    const error = new Error("Discount code is invalid.");
    error.status = 400;
    throw error;
  }
  if (requestedCode && requestedCode !== discount.code) {
    const error = new Error("Discount code does not match this discount.");
    error.status = 400;
    throw error;
  }
  if (!isDiscountLive(discount)) {
    const error = new Error("Discount code is inactive or expired.");
    error.status = 400;
    throw error;
  }

  const discountAmount = calculateDiscountAmount(discount, subtotal);
  if (discountAmount <= 0) {
    const minSubtotal = toMoney(discount.minSubtotal, 0);
    const error = new Error(
      minSubtotal > 0
        ? `Order subtotal must be at least ${minSubtotal} to use this code.`
        : "Discount is not applicable for this order.",
    );
    error.status = 400;
    throw error;
  }

  return {
    discountAmount,
    discount: buildDiscountSnapshot(discount, discountAmount),
  };
};

const calculateCanonicalTotals = async (prisma, payload) => {
  const subtotal = calculateSubtotalFromItems(payload.items);
  const shippingFee = calculateShippingFee(subtotal);
  const paymentFee = calculatePaymentFee(payload.paymentMethod);
  const { discountAmount, discount } = await resolveAppliedDiscount(
    prisma,
    payload.discount,
    subtotal,
  );
  const total = roundMoney(Math.max(subtotal + shippingFee + paymentFee - discountAmount, 0));

  return {
    subtotal,
    shippingFee,
    paymentFee,
    discountAmount,
    discountCode: discount?.code || null,
    total,
    currency:
      String(payload?.totals?.currency || payload?.items?.[0]?.currency || "INR")
        .trim()
        .toUpperCase() || "INR",
    discount,
  };
};

const getRazorpayCreds = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
};

const createRazorpayAuthorization = ({ keyId, keySecret }) =>
  `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

const verifyRazorpaySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature, keySecret }) => {
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(razorpaySignature || ""));

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

exports.createOrder = async (req, res, next) => {
  try {
    const payload = createOrderSchema.parse(req.body);
    const prisma = await getPrisma();
    const canonicalTotals = await calculateCanonicalTotals(prisma, payload);

    const order = await prisma.order.create({
      data: {
        number: createOrderNumber(),
        status: OrderStatus.PENDING,
        paymentMethod: payload.paymentMethod,
        totals: canonicalTotals,
        shipping: payload.shipping,
        items: payload.items,
        userId: req.user?.id,
      },
    });

    res.status(201);
    return sendSuccess(res, sanitizeOrder(order));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    const message = String(error?.message || "");
    const isCancelledEnumMismatch =
      message.includes("invalid input value for enum") &&
      message.includes("CANCELLED");
    if (isCancelledEnumMismatch) {
      return sendError(
        res,
        503,
        "Order cancellation is unavailable until the database migration is applied.",
      );
    }
    if (error?.status) {
      return sendError(res, error.status, error.message || "Invalid payload");
    }
    return next(error);
  }
};

exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const creds = getRazorpayCreds();
    if (!creds) {
      return sendError(res, 500, "Razorpay is not configured.");
    }

    const payload = createRazorpayOrderSchema.parse(req.body || {});
    let amount = payload.amount;
    let currency = (payload.currency || "INR").toUpperCase();
    let canonicalTotals = null;

    if (payload.order) {
      const prisma = await getPrisma();
      canonicalTotals = await calculateCanonicalTotals(prisma, payload.order);
      amount = Math.round(toMoney(canonicalTotals.total, 0) * 100);
      currency = canonicalTotals.currency || currency;
    }

    if (!amount || amount <= 0) {
      return sendError(res, 400, "Order amount must be greater than zero.");
    }

    const notes = { ...(payload.notes || {}) };
    if (canonicalTotals?.discountCode) {
      notes.discountCode = canonicalTotals.discountCode;
    }
    if (canonicalTotals?.discountAmount > 0) {
      notes.discountAmount = String(canonicalTotals.discountAmount);
    }
    if (canonicalTotals?.total > 0) {
      notes.computedTotal = String(canonicalTotals.total);
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: createRazorpayAuthorization(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: payload.receipt || `rcpt_${Date.now()}`,
        notes,
      }),
    });

    const text = await response.text();
    const razorpayPayload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      return sendError(
        res,
        502,
        razorpayPayload?.error?.description ||
          razorpayPayload?.message ||
          "Unable to create Razorpay order.",
      );
    }

    return sendSuccess(res, {
      keyId: creds.keyId,
      order: razorpayPayload,
      pricing: canonicalTotals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    if (error?.status) {
      return sendError(res, error.status, error.message || "Invalid payload");
    }
    return next(error);
  }
};

exports.confirmRazorpayCheckout = async (req, res, next) => {
  try {
    const creds = getRazorpayCreds();
    if (!creds) {
      return sendError(res, 500, "Razorpay is not configured.");
    }

    const payload = confirmRazorpayCheckoutSchema.parse(req.body || {});
    const { payment, order } = payload;

    const isValid = verifyRazorpaySignature({
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpaySignature: payment.razorpaySignature,
      keySecret: creds.keySecret,
    });

    if (!isValid) {
      return sendError(res, 400, "Payment signature verification failed.");
    }

    const prisma = await getPrisma();
    const canonicalTotals = await calculateCanonicalTotals(prisma, order);
    const created = await prisma.order.create({
      data: {
        number: createOrderNumber(),
        status: OrderStatus.PAID,
        paymentMethod: order.paymentMethod || "RAZORPAY",
        totals: canonicalTotals,
        shipping: {
          ...(order.shipping || {}),
          paymentId: payment.razorpayPaymentId,
          paymentOrderId: payment.razorpayOrderId,
          paymentGateway: "RAZORPAY",
        },
        items: order.items,
        userId: req.user?.id,
      },
    });

    return sendSuccess(res, sanitizeOrder(created));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    if (error?.status) {
      return sendError(res, error.status, error.message || "Invalid payload");
    }
    return next(error);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return sendSuccess(res, orders.map(sanitizeOrder));
  } catch (error) {
    return next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const payload = orderActionSchema.parse(req.body || {});
    const prisma = await getPrisma();

    const order = await findMyOrder(prisma, req.user.id, req.params.id);
    if (!order) {
      return sendError(res, 404, "Order not found");
    }
    if (order.status === OrderStatus.CANCELLED) {
      return sendError(res, 400, "Order is already cancelled.");
    }
    if (![OrderStatus.PENDING, OrderStatus.PAID].includes(order.status)) {
      return sendError(res, 400, "Only pending or paid orders can be cancelled.");
    }

    const { selected, unknownIds } = getRequestedLines(order, payload.items);
    if (unknownIds.length) {
      return sendError(res, 400, "One or more selected items do not belong to this order.");
    }

    const normalizedSelectedItems = selected.map((entry) => ({
      id: entry.lineId,
      ...entry.item,
    }));

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          shipping: {
            ...(order.shipping || {}),
            cancellation: {
              reason: payload.reason,
              comments: payload.comments || "",
              cancelledAt: new Date().toISOString(),
              cancelledByUserId: req.user.id,
            },
          },
        },
      });

      const request = await tx.orderRequest.create({
        data: {
          orderId: order.id,
          userId: req.user.id,
          type: OrderRequestType.CANCEL,
          status: "APPROVED",
          items: normalizedSelectedItems,
          reason: payload.reason,
          comments: payload.comments || null,
          attachments: payload.attachments || [],
          resolvedAt: new Date(),
        },
      });

      return { updatedOrder, request };
    });

    return sendSuccess(res, {
      order: sanitizeOrder(result.updatedOrder),
      request: sanitizeOrderRequest(result.request),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    return next(error);
  }
};

const createOrderRequest = async (req, res, next, type) => {
  try {
    const payload = returnExchangeSchema.parse(req.body || {});
    const prisma = await getPrisma();
    const order = await findMyOrder(prisma, req.user.id, req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }
    if (order.status === OrderStatus.CANCELLED) {
      return sendError(res, 400, "Cannot create a request for a cancelled order.");
    }
    if (order.status !== OrderStatus.FULFILLED) {
      return sendError(res, 400, "Return or exchange is available only for delivered orders.");
    }

    const { selected, unknownIds } = getRequestedLines(order, payload.items);
    if (unknownIds.length) {
      return sendError(res, 400, "One or more selected items do not belong to this order.");
    }

    const normalizedSelectedItems = selected.map((entry) => ({
      id: entry.lineId,
      ...entry.item,
    }));

    const request = await prisma.orderRequest.create({
      data: {
        orderId: order.id,
        userId: req.user.id,
        type,
        status: "REQUESTED",
        items: normalizedSelectedItems,
        reason: payload.reason,
        comments: payload.comments || null,
        attachments: payload.attachments || [],
        bankDetails: payload.bankDetails || null,
      },
    });

    return sendSuccess(res, sanitizeOrderRequest(request));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    return next(error);
  }
};

exports.createReturnRequest = async (req, res, next) =>
  createOrderRequest(req, res, next, OrderRequestType.RETURN);

exports.createExchangeRequest = async (req, res, next) =>
  createOrderRequest(req, res, next, OrderRequestType.EXCHANGE);

exports.listMyOrderRequests = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const requests = await prisma.orderRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, requests.map(sanitizeOrderRequest));
  } catch (error) {
    return next(error);
  }
};

exports.listOrders = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const take = Math.min(Number.parseInt(req.query?.limit, 10) || 50, 200);
    const pageNumber = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
    const skip = (pageNumber - 1) * take;
    const statusToken = String(req.query?.status || "").trim().toUpperCase();
    const searchToken = String(req.query?.search || "").trim();

    const where = {};
    if (statusToken && Object.values(OrderStatus).includes(statusToken)) {
      where.status = statusToken;
    }
    if (searchToken) {
      where.OR = [
        {
          number: {
            contains: searchToken,
          },
        },
        {
          user: {
            is: {
              email: {
                contains: searchToken,
              },
            },
          },
        },
        {
          user: {
            is: {
              name: {
                contains: searchToken,
              },
            },
          },
        },
      ];
    }

    const [orders, total, totalFiltered] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.order.count(),
      prisma.order.count({ where }),
    ]);

    // Summary counts use full table (lightweight count queries)
    const [pending, paid, fulfilled] = await Promise.all([
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.PAID } }),
      prisma.order.count({ where: { status: OrderStatus.FULFILLED } }),
    ]);

    let cancelled = 0;
    try {
      cancelled = await prisma.order.count({ where: { status: OrderStatus.CANCELLED } });
    } catch (error) {
      const message = String(error?.message || "");
      const isEnumMismatch =
        message.includes("invalid input value for enum") &&
        message.includes("CANCELLED");
      if (!isEnumMismatch) {
        throw error;
      }
    }

    const summary = {
      total,
      filteredTotal: totalFiltered,
      pending,
      paid,
      fulfilled,
      cancelled,
      // Revenue is computed from the current page only (for true total, use a dedicated analytics endpoint)
      revenue: orders.reduce((acc, o) => acc + (Number(o.totals?.total) || 0), 0),
    };

    return sendSuccess(res, {
      items: orders.map((order) => ({
        ...sanitizeOrder(order),
        customer: order.user ? { id: order.user.id, name: order.user.name, email: order.user.email } : null,
      })),
      summary,
    }, { total: totalFiltered, page: pageNumber, limit: take });
  } catch (error) {
    return next(error);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const updates = updateOrderSchema.parse(req.body);
    if (!updates.status && !updates.shipping) {
      return sendError(res, 400, "No updates provided");
    }
    const prisma = await getPrisma();
    let nextShipping = undefined;

    if (updates.shipping) {
      const existing = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { shipping: true },
      });
      if (!existing) {
        return sendError(res, 404, "Order not found");
      }
      const currentShipping =
        existing.shipping && typeof existing.shipping === "object"
          ? existing.shipping
          : {};
      nextShipping = {
        ...currentShipping,
        ...updates.shipping,
      };
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: updates.status,
        shipping: nextShipping,
      },
    });
    return sendSuccess(res, sanitizeOrder(order));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    if (error.code === "P2025") {
      return sendError(res, 404, "Order not found");
    }
    return next(error);
  }
};

const trackSchema = z
  .object({
    orderId: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .refine((payload) => payload.email || payload.phone, {
    message: "Email or phone is required",
  });

const normalizeOrderNumber = (value = "") => {
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("#")) return raw.slice(1);
  return raw;
};

exports.trackOrder = async (req, res, next) => {
  try {
    const payload = trackSchema.parse(req.body);
    const prisma = await getPrisma();

    const normalizedOrder = normalizeOrderNumber(payload.orderId);

    const order = await prisma.order.findFirst({
      where: {
        number: normalizedOrder,
      },
    });

    if (!order) {
      return sendError(res, 404, "No order found for those details.");
    }

    const shipping = order.shipping || {};
    const emailMatches =
      !payload.email || String(shipping.email || "").toLowerCase() === payload.email.toLowerCase();
    const phoneMatches =
      !payload.phone || String(shipping.phone || "").replace(/[^\d+]/g, "") ===
      String(payload.phone || "").replace(/[^\d+]/g, "");

    if (payload.email && !emailMatches) {
      return sendError(res, 404, "No order found for those details.");
    }
    if (payload.phone && !phoneMatches) {
      return sendError(res, 404, "No order found for those details.");
    }

    return sendSuccess(res, sanitizeOrder(order));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
    }
    return next(error);
  }
};
