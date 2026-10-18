// src/knowledge-base/services/KnowledgeBaseService.js
const KnowledgeBase = require('../models/KnowledgeBase');
const { recordLog } = require('../logs/knowledgeLogger');

function generateSlug(title, suffix = '') {
  const base = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return suffix ? `${base}-${suffix}` : base || 'kb-article';
}

async function ensureUniqueSlug(title, currentId = null) {
  let baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await KnowledgeBase.findOne({ slug });
    if (!existing || (currentId && existing._id.toString() === currentId.toString())) {
      return slug;
    }
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

class KnowledgeBaseService {
  static async createArticle(payload, user = {}) {
    if (!payload.title) {
      const err = new Error('Title is required');
      err.statusCode = 400;
      throw err;
    }
    if (!payload.content) {
      const err = new Error('Content is required');
      err.statusCode = 400;
      throw err;
    }

    const slug = payload.slug ? generateSlug(payload.slug) : await ensureUniqueSlug(payload.title);

    const articleData = {
      title: payload.title.trim(),
      slug,
      category: payload.category ? payload.category.trim().toLowerCase() : 'general',
      tags: Array.isArray(payload.tags) ? payload.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean) : [],
      summary: payload.summary ? payload.summary.trim() : '',
      content: payload.content,
      author: {
        id: user.id || user._id || null,
        name: user.name || user.email || 'Admin',
        email: user.email || ''
      },
      status: payload.status || 'draft',
      priority: typeof payload.priority === 'number' ? payload.priority : 0,
      isPinned: Boolean(payload.isPinned),
      metadata: payload.metadata || {},
      lastReviewedAt: new Date()
    };

    const article = new KnowledgeBase(articleData);
    const saved = await article.save();

    await recordLog({
      action: 'create',
      entityType: 'article',
      entityId: saved._id,
      entityTitle: saved.title,
      performedBy: user,
      details: { category: saved.category, status: saved.status, slug: saved.slug }
    });

    return saved;
  }

  static async getAllArticles(params = {}) {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    if (params.category) {
      query.category = params.category.trim().toLowerCase();
    }

    if (params.status) {
      query.status = params.status;
    }

    if (params.tag) {
      query.tags = params.tag.trim().toLowerCase();
    }

    if (params.q) {
      const escaped = params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { title: regex },
        { summary: regex },
        { content: regex },
        { tags: regex }
      ];
    }

    const sort = {};
    if (params.sort === 'views') {
      sort.viewsCount = -1;
    } else if (params.sort === 'title') {
      sort.title = 1;
    } else {
      sort.isPinned = -1;
      sort.createdAt = -1;
    }

    const [articles, totalCount] = await Promise.all([
      KnowledgeBase.find(query).sort(sort).skip(skip).limit(limit).lean(),
      KnowledgeBase.countDocuments(query)
    ]);

    return {
      articles,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  static async getArticleById(idOrSlug, options = {}) {
    let query;
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      query = { $or: [{ _id: idOrSlug }, { slug: idOrSlug }] };
    } else {
      query = { slug: idOrSlug };
    }

    let article = await KnowledgeBase.findOne(query);
    if (!article) return null;

    if (options.incrementView) {
      article.viewsCount = (article.viewsCount || 0) + 1;
      await article.save();
    }

    return article.toObject();
  }

  static async updateArticle(id, payload, user = {}) {
    const article = await KnowledgeBase.findById(id);
    if (!article) {
      const err = new Error('Knowledge base article not found');
      err.statusCode = 404;
      throw err;
    }

    if (payload.title && payload.title.trim() !== article.title) {
      article.title = payload.title.trim();
      if (!payload.slug) {
        article.slug = await ensureUniqueSlug(article.title, article._id);
      }
    }

    if (payload.slug) {
      article.slug = await ensureUniqueSlug(payload.slug, article._id);
    }

    if (payload.category !== undefined) {
      article.category = payload.category.trim().toLowerCase();
    }

    if (payload.content !== undefined) {
      article.content = payload.content;
    }

    if (payload.summary !== undefined) {
      article.summary = payload.summary.trim();
    }

    if (Array.isArray(payload.tags)) {
      article.tags = payload.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
    }

    if (payload.status) {
      article.status = payload.status;
    }

    if (typeof payload.priority === 'number') {
      article.priority = payload.priority;
    }

    if (payload.isPinned !== undefined) {
      article.isPinned = Boolean(payload.isPinned);
    }

    if (payload.metadata) {
      article.metadata = { ...article.metadata, ...payload.metadata };
    }

    article.lastReviewedAt = new Date();

    const updated = await article.save();

    await recordLog({
      action: 'update',
      entityType: 'article',
      entityId: updated._id,
      entityTitle: updated.title,
      performedBy: user,
      details: { changes: Object.keys(payload) }
    });

    return updated;
  }

  static async deleteArticle(id, user = {}) {
    const article = await KnowledgeBase.findById(id);
    if (!article) {
      const err = new Error('Knowledge base article not found');
      err.statusCode = 404;
      throw err;
    }

    await KnowledgeBase.findByIdAndDelete(id);

    await recordLog({
      action: 'delete',
      entityType: 'article',
      entityId: id,
      entityTitle: article.title,
      performedBy: user
    });

    return { id, title: article.title, deleted: true };
  }

  static async updateStatus(id, status, user = {}) {
    const validStatuses = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const article = await KnowledgeBase.findById(id);
    if (!article) {
      const err = new Error('Knowledge base article not found');
      err.statusCode = 404;
      throw err;
    }

    const oldStatus = article.status;
    article.status = status;
    const updated = await article.save();

    await recordLog({
      action: 'status_change',
      entityType: 'article',
      entityId: id,
      entityTitle: article.title,
      performedBy: user,
      details: { from: oldStatus, to: status }
    });

    return updated;
  }

  static async getCategories() {
    const categories = await KnowledgeBase.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          publishedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return categories.map(c => ({
      category: c._id,
      count: c.count,
      publishedCount: c.publishedCount
    }));
  }
}

module.exports = KnowledgeBaseService;
