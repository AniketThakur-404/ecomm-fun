const bcrypt = require('bcrypt');
const { z } = require('zod');

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
