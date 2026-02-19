const bcrypt = require('bcrypt');
const { z } = require('zod');
const { OrderStatus } = require('@prisma/client');

const { getPrisma } = require('../db/prismaClient');
const { signToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

exports.login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN') {
      return sendError(res, 401, 'Invalid email or password');
    }

    const isValid = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!isValid) {
      return sendError(res, 401, 'Invalid email or password');
    }

    return sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token: signToken({ id: user.id, role: user.role }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || 'Invalid payload');
    }
    return next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const prisma = await getPrisma();

    const [
      totalProducts,
      activeProducts,
      draftProducts,
      totalOrders,
      pendingOrders,
      paidOrders,
      fulfilledOrders,
      totalUsers,
      adminUsers,
      customerUsers,
      totalCollections,
      recentOrders,
      totalRevenue,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'DRAFT' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.PAID } }),
      prisma.order.count({ where: { status: OrderStatus.FULFILLED } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.collection.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      Promise.resolve(null), // Revenue calculation done separately
    ]);

    // Calculate revenue from paid and fulfilled orders
    const allPaidOrders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PAID, OrderStatus.FULFILLED] },
      },
      select: {
        totals: true,
      },
    });

    const revenue = allPaidOrders.reduce((sum, order) => {
      const total = Number(order.totals?.total || 0);
      return sum + total;
    }, 0);

    let cancelledOrders = 0;
    try {
      cancelledOrders = await prisma.order.count({
        where: { status: OrderStatus.CANCELLED },
      });
    } catch (error) {
      const message = String(error?.message || '');
      const isEnumMismatch =
        message.includes('invalid input value for enum') &&
        message.includes('CANCELLED');
      if (!isEnumMismatch) {
        throw error;
      }
    }

    return sendSuccess(res, {
      products: {
        total: totalProducts,
        active: activeProducts,
        draft: draftProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        fulfilled: fulfilledOrders,
        cancelled: cancelledOrders,
        recent: recentOrders.map((order) => ({
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.totals?.total || 0,
          currency: order.totals?.currency || 'INR',
          customer: order.user
            ? {
                name: order.user.name,
                email: order.user.email,
              }
            : null,
          createdAt: order.createdAt,
        })),
      },
      users: {
        total: totalUsers,
        admins: adminUsers,
        customers: customerUsers,
      },
      collections: {
        total: totalCollections,
      },
      revenue: {
        total: revenue,
        currency: 'INR',
      },
    });
  } catch (error) {
    return next(error);
  }
};
