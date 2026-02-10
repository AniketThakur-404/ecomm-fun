const { z } = require("zod");

const { getPrisma } = require("../db/prismaClient");
const { OrderStatus } = require("@prisma/client");
const { sendSuccess, sendError } = require("../utils/response");

const shippingSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

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

const createOrderNumber = () => `ORD-${Date.now().toString(36).toUpperCase()}`;

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

exports.listOrders = async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const orders = await prisma.order.findMany({
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const summary = {
      total: orders.length,
      pending: orders.filter((o) => o.status === OrderStatus.PENDING).length,
      paid: orders.filter((o) => o.status === OrderStatus.PAID).length,
      fulfilled: orders.filter((o) => o.status === OrderStatus.FULFILLED).length,
      revenue: orders.reduce((acc, o) => acc + (Number(o.totals?.total) || 0), 0),
    };

    return sendSuccess(res, {
      items: orders.map((order) => ({
        ...sanitizeOrder(order),
        customer: order.user ? { id: order.user.id, name: order.user.name, email: order.user.email } : null,
      })),
      summary,
    });
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
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: updates.status,
        shipping: updates.shipping ? { ...updates.shipping } : undefined,
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
