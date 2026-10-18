// src/knowledge-base/controllers/KnowledgeBaseController.js
const KnowledgeBaseService = require('../services/KnowledgeBaseService');

class KnowledgeBaseController {
  static async createArticle(request, context) {
    try {
      const payload = (await request.json()) || {};
      const user = context.user || {};
      const data = await KnowledgeBaseService.createArticle(payload, user);

      return {
        status: 201,
        jsonBody: { success: true, message: 'Knowledge base article created successfully', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Create KB article error:', err);
      return {
        status: err.statusCode || 500,
        jsonBody: { success: false, message: err.message || 'Failed to create article' }
      };
    }
  }

  static async getArticles(request, context) {
    try {
      const query = request.query || {};
      const result = await KnowledgeBaseService.getAllArticles(query);

      return {
        status: 200,
        jsonBody: { success: true, data: result.articles, pagination: result.pagination }
      };
    } catch (err) {
      if (context && context.error) context.error('Get KB articles error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: 'Failed to fetch knowledge base articles' }
      };
    }
  }

  static async getArticleById(request, context) {
    try {
      const { id } = request.params || {};
      const incrementView = (request.query || {}).view === 'true';
      const data = await KnowledgeBaseService.getArticleById(id, { incrementView });

      if (!data) {
        return {
          status: 404,
          jsonBody: { success: false, message: 'Knowledge base article not found' }
        };
      }

      return {
        status: 200,
        jsonBody: { success: true, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Get KB article error:', err);
      return {
        status: err.name === 'CastError' ? 400 : 500,
        jsonBody: { success: false, message: err.name === 'CastError' ? 'Invalid article ID' : 'Failed to fetch article' }
      };
    }
  }

  static async updateArticle(request, context) {
    try {
      const { id } = request.params || {};
      const payload = (await request.json()) || {};
      const user = context.user || {};

      const data = await KnowledgeBaseService.updateArticle(id, payload, user);

      return {
        status: 200,
        jsonBody: { success: true, message: 'Article updated successfully', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Update KB article error:', err);
      return {
        status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
        jsonBody: { success: false, message: err.message || 'Failed to update article' }
      };
    }
  }

  static async deleteArticle(request, context) {
    try {
      const { id } = request.params || {};
      const user = context.user || {};
      const data = await KnowledgeBaseService.deleteArticle(id, user);

      return {
        status: 200,
        jsonBody: { success: true, message: 'Article deleted successfully', data }
      };
    } catch (err) {
      if (context && context.error) context.error('Delete KB article error:', err);
      return {
        status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
        jsonBody: { success: false, message: err.message || 'Failed to delete article' }
      };
    }
  }

  static async updateStatus(request, context) {
    try {
      const { id } = request.params || {};
      const payload = (await request.json()) || {};
      const user = context.user || {};

      if (!payload.status) {
        return {
          status: 400,
          jsonBody: { success: false, message: 'Status is required' }
        };
      }

      const data = await KnowledgeBaseService.updateStatus(id, payload.status, user);

      return {
        status: 200,
        jsonBody: { success: true, message: `Status updated to ${payload.status}`, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Update KB status error:', err);
      return {
        status: err.statusCode || 500,
        jsonBody: { success: false, message: err.message || 'Failed to update status' }
      };
    }
  }

  static async getCategories(request, context) {
    try {
      const data = await KnowledgeBaseService.getCategories();
      return {
        status: 200,
        jsonBody: { success: true, data }
      };
    } catch (err) {
      if (context && context.error) context.error('Get KB categories error:', err);
      return {
        status: 500,
        jsonBody: { success: false, message: 'Failed to fetch categories' }
      };
    }
  }
}

module.exports = KnowledgeBaseController;
