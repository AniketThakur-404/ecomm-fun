const { z } = require('zod');

const { getPrisma } = require('../db/prismaClient');
const { sendSuccess, sendError } = require('../utils/response');

const COLLECTION_TYPES = ['MANUAL', 'AUTOMATED'];

const slugify = (value) => {
  if (!value) return undefined;
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const baseCollectionSchema = z.object({
  title: z.string().min(1),
  handle: z.string().min(1),
  descriptionHtml: z.string().optional(),
  imageUrl: z.string().url().optional(),
  type: z.enum(COLLECTION_TYPES).optional(),
  rules: z.any().optional(),
  templateSuffix: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
  parentId: z.string().optional().nullable(),
  parentHandle: z.string().optional(),
});

const normalizeCollectionInput = (raw = {}, { partial = false } = {}) => {
  const normalized = { ...raw };

  if (raw.title !== undefined) normalized.title = String(raw.title).trim();
  if (raw.handle !== undefined) {
    normalized.handle = String(raw.handle).trim() || slugify(raw.title);
  } else if (!partial && raw.title) {
    normalized.handle = slugify(raw.title);
  }

  if (raw.descriptionHtml !== undefined) {
    normalized.descriptionHtml = String(raw.descriptionHtml);
  } else if (raw.description !== undefined) {
    normalized.descriptionHtml = String(raw.description);
  }

  if (raw.imageUrl !== undefined) normalized.imageUrl = String(raw.imageUrl).trim();

  if (raw.type !== undefined) {
    const type = String(raw.type).toUpperCase();
    if (COLLECTION_TYPES.includes(type)) normalized.type = type;
  }

  if (raw.rules !== undefined) normalized.rules = raw.rules;
  if (raw.templateSuffix !== undefined) normalized.templateSuffix = String(raw.templateSuffix).trim();
  if (raw.publishedAt !== undefined) normalized.publishedAt = raw.publishedAt;

  if (raw.parentId !== undefined) normalized.parentId = raw.parentId || null;
  if (raw.parentHandle !== undefined) {
    normalized.parentHandle = String(raw.parentHandle).trim();
  }

  return normalized;
};

const parseCollectionInput = (raw, { partial = false } = {}) => {
  const normalized = normalizeCollectionInput(raw, { partial });
  const schema = partial ? baseCollectionSchema.partial() : baseCollectionSchema;
  return schema.parse(normalized);
};

const collectionInclude = {
  parent: true,
  children: true,
  _count: { select: { products: true } },
};

const collectionListSelect = {
  id: true,
  handle: true,
  title: true,
  descriptionHtml: true,
  imageUrl: true,
  parentId: true,
  publishedAt: true,
};

const collectionDetailSelect = {
  id: true,
  handle: true,
  title: true,
  descriptionHtml: true,
  imageUrl: true,
  type: true,
  rules: true,
  templateSuffix: true,
  publishedAt: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
};

const collectionCompactSelect = collectionListSelect;

const resolveParentId = async (prisma, payload) => {
  if (payload.parentId !== undefined) return payload.parentId;
  if (!payload.parentHandle) return undefined;
  const parent = await prisma.collection.findUnique({
    where: { handle: payload.parentHandle },
    select: { id: true },
  });
  return parent?.id ?? null;
};

exports.listCollections = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
    const limit = Number.parseInt(req.query?.limit, 10);
    const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 24;
    const skip = (page - 1) * take;

    const includeMode = String(req.query?.include ?? '').toLowerCase();
    const includeOptions =
      includeMode === 'full' ? { include: collectionInclude } : { select: collectionListSelect };

    const [collections, total] = await Promise.all([
      prisma.collection.findMany({
        orderBy: { title: 'asc' },
        ...includeOptions,
        take,
        skip,
      }),
      prisma.collection.count(),
    ]);

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return sendSuccess(res, collections, { total, page, limit: take });
  } catch (error) {
    return next(error);
  }
};

exports.getCollection = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const includeMode = String(req.query?.include ?? '').toLowerCase();
    const includeOptions =
      includeMode === 'compact'
        ? { select: collectionCompactSelect }
        : includeMode === 'detail'
          ? { select: collectionDetailSelect }
          : {
            include: {
              ...collectionInclude,
              products: {
                include: { product: { select: { id: true, title: true, handle: true } } },
              },
            },
          };
    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      ...includeOptions,
    });
    if (!collection) {
      return sendError(res, 404, 'Collection not found');
    }
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return sendSuccess(res, collection);
  } catch (error) {
    return next(error);
  }
};

exports.getCollectionBySlug = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    const includeMode = String(req.query?.include ?? '').toLowerCase();
    const includeOptions =
      includeMode === 'compact'
        ? { select: collectionCompactSelect }
        : includeMode === 'detail'
          ? { select: collectionDetailSelect }
          : { include: collectionInclude };
    const collection = await prisma.collection.findUnique({
      where: { handle: req.params.slug },
      ...includeOptions,
    });
    if (!collection) {
      return sendError(res, 404, 'Collection not found');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[API] getCollectionBySlug', {
        slug: req.params.slug,
        include: includeMode || 'default',
        collection: {
          id: collection.id,
          handle: collection.handle,
          title: collection.title,
          productCount: collection?._count?.products ?? null,
        },
      });
    }
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return sendSuccess(res, collection);
  } catch (error) {
    return next(error);
  }
};

exports.createCollection = async (req, res, next) => {
  try {
    const payload = parseCollectionInput(req.body);
    const prisma = await getPrisma();
    const parentId = await resolveParentId(prisma, payload);

    const collection = await prisma.collection.create({
      data: {
        title: payload.title,
        handle: payload.handle,
        descriptionHtml: payload.descriptionHtml,
        imageUrl: payload.imageUrl,
        type: payload.type ?? 'MANUAL',
        rules: payload.rules,
        templateSuffix: payload.templateSuffix,
        publishedAt: payload.publishedAt ?? null,
        parentId,
      },
      include: collectionInclude,
    });
    res.status(201);
    return sendSuccess(res, collection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || 'Invalid payload');
    }
    if (error.code === 'P2002') {
      return sendError(res, 409, 'Collection handle already exists');
    }
    return next(error);
  }
};

exports.updateCollection = async (req, res, next) => {
  try {
    const payload = parseCollectionInput(req.body, { partial: true });
    const prisma = await getPrisma();
    const parentId = await resolveParentId(prisma, payload);

    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        title: payload.title,
        handle: payload.handle,
        descriptionHtml: payload.descriptionHtml,
        imageUrl: payload.imageUrl,
        type: payload.type,
        rules: payload.rules,
        templateSuffix: payload.templateSuffix,
        publishedAt: payload.publishedAt ?? undefined,
        parentId: parentId ?? payload.parentId,
      },
      include: collectionInclude,
    });
    return sendSuccess(res, collection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, 400, error.errors[0]?.message || 'Invalid payload');
    }
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Collection not found');
    }
    if (error.code === 'P2002') {
      return sendError(res, 409, 'Collection handle already exists');
    }
    return next(error);
  }
};

exports.deleteCollection = async (req, res, next) => {
  try {
    const prisma = await getPrisma();
    await prisma.collection.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return sendError(res, 404, 'Collection not found');
    }
    return next(error);
  }
};
