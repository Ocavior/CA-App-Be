// src/knowledge-base/tasks/maintenanceTask.js
const KnowledgeBase = require('../models/KnowledgeBase');
const KnowledgeTask = require('../models/KnowledgeTask');
const { recordLog } = require('../logs/knowledgeLogger');

/**
 * Execute automated maintenance tasks for the Knowledge Base:
 * 1. Find stale articles (not reviewed within threshold days) and generate review tasks.
 * 2. Flag overdue open tasks.
 * 3. Log the maintenance summary.
 *
 * @param {Object} options
 * @param {number} options.staleThresholdDays Days after which an unreviewed article needs a review task (default 90)
 * @param {Object} options.user Authenticated user triggering or running the task
 */
async function runMaintenance({ staleThresholdDays = 90, user = {} } = {}) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - staleThresholdDays);

  const results = {
    staleArticlesFound: 0,
    reviewTasksCreated: 0,
    overdueTasksFound: 0,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Find published articles with lastReviewedAt older than cutoffDate or null
    const staleArticles = await KnowledgeBase.find({
      status: 'published',
      $or: [
        { lastReviewedAt: { $lt: cutoffDate } },
        { lastReviewedAt: null }
      ]
    });

    results.staleArticlesFound = staleArticles.length;

    for (const article of staleArticles) {
      // Check if an open review task already exists for this article
      const existingTask = await KnowledgeTask.findOne({
        articleId: article._id,
        taskType: 'review',
        status: { $in: ['pending', 'in_progress'] }
      });

      if (!existingTask) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 2 weeks to review

        await KnowledgeTask.create({
          title: `Periodic Review: ${article.title}`,
          description: `This article has not been reviewed for ${staleThresholdDays}+ days. Please review and update content if necessary.`,
          articleId: article._id,
          taskType: 'review',
          priority: 'medium',
          status: 'pending',
          dueDate,
          createdBy: {
            id: user.id || user._id || null,
            name: 'Maintenance Job',
            email: 'system@knowledgebase.internal'
          }
        });

        results.reviewTasksCreated += 1;
      }
    }

    // 2. Identify overdue tasks that are still pending or in_progress
    const now = new Date();
    const overdueTasks = await KnowledgeTask.find({
      dueDate: { $lt: now },
      status: { $in: ['pending', 'in_progress'] }
    });

    results.overdueTasksFound = overdueTasks.length;

    // 3. Record maintenance run in knowledge log
    await recordLog({
      action: 'maintenance_run',
      entityType: 'system',
      entityTitle: 'Automated KB Maintenance Job',
      performedBy: user,
      details: results,
      status: 'success'
    });

    return results;
  } catch (err) {
    console.error('KB Maintenance error:', err);
    await recordLog({
      action: 'maintenance_run',
      entityType: 'system',
      entityTitle: 'Automated KB Maintenance Job',
      performedBy: user,
      details: { error: err.message, stack: err.stack },
      status: 'failure'
    });
    throw err;
  }
}

module.exports = { runMaintenance };
