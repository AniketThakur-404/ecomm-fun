const crypto = require("node:crypto");
const { z } = require("zod");

const { getPrisma } = require("../db/prismaClient");
const { OrderStatus, OrderRequestType } = require("@prisma/client");
const { sendSuccess, sendError } = require("../utils/response");

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

const createOrderSchema = z.object({
  paymentMethod: z.string().max(64).optional(),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    shippingFee: z.number().nonnegative(),
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
  amount: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  receipt: z.string().max(64).optional(),
  notes: z.record(z.string()).optional(),
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

    const order = await prisma.order.create({
      data: {
        number: createOrderNumber(),
        status: OrderStatus.PENDING,
        paymentMethod: payload.paymentMethod,
        totals: payload.totals,
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
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: createRazorpayAuthorization(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: payload.amount,
        currency: (payload.currency || "INR").toUpperCase(),
        receipt: payload.receipt || `rcpt_${Date.now()}`,
        notes: payload.notes || {},
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
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || "Invalid payload");
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
    const created = await prisma.order.create({
      data: {
        number: createOrderNumber(),
        status: OrderStatus.PAID,
        paymentMethod: order.paymentMethod || "RAZORPAY",
        totals: order.totals,
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
