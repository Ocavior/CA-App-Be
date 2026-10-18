// test/modules/knowledge-base/knowledge-base.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  KnowledgeBase,
  KnowledgeTask,
  KnowledgeLog,
  KnowledgeBaseService,
  KnowledgeTaskService,
  KnowledgeLogService,
  runMaintenance,
  KnowledgeBaseController,
  KnowledgeTaskController,
  KnowledgeLogController
} = require('../../src/knowledge-base');

describe('Knowledge Base Package Tests', () => {
  let mongod;

  const mockUser = {
    id: '60d5ec49f1b2c8b1f8e4e1a1',
    name: 'Test Admin',
    email: 'admin@example.com',
    role: 'superadmin'
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri('knowledge_base_test');
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      KnowledgeBase.deleteMany({}),
      KnowledgeTask.deleteMany({}),
      KnowledgeLog.deleteMany({})
    ]);
  });

  describe('KnowledgeBaseService', () => {
    it('creates an article with auto-generated slug and logs the event', async () => {
      const article = await KnowledgeBaseService.createArticle({
        title: 'Income Tax Return Guide',
        category: 'Taxation',
        tags: ['itr', 'tax'],
        summary: 'Guide for filing ITR',
        content: '# ITR filing instructions',
        status: 'published'
      }, mockUser);

      expect(article._id).toBeDefined();
      expect(article.title).toBe('Income Tax Return Guide');
      expect(article.slug).toBe('income-tax-return-guide');
      expect(article.category).toBe('taxation');
      expect(article.status).toBe('published');

      // Verify audit log was created
      const logs = await KnowledgeLog.find({ entityId: article._id.toString(), action: 'create' });
      expect(logs).toHaveLength(1);
      expect(logs[0].entityType).toBe('article');
      expect(logs[0].entityTitle).toBe('Income Tax Return Guide');
    });

    it('generates a unique slug when creating articles with identical titles', async () => {
      const first = await KnowledgeBaseService.createArticle({
        title: 'GST Advisory',
        content: 'Content 1'
      }, mockUser);

      const second = await KnowledgeBaseService.createArticle({
        title: 'GST Advisory',
        content: 'Content 2'
      }, mockUser);

      expect(first.slug).toBe('gst-advisory');
      expect(second.slug).toBe('gst-advisory-2');
    });

    it('rejects an article missing title or content', async () => {
      await expect(KnowledgeBaseService.createArticle({ content: 'no title' }, mockUser))
        .rejects.toThrow('Title is required');

      await expect(KnowledgeBaseService.createArticle({ title: 'no content' }, mockUser))
        .rejects.toThrow('Content is required');
    });

    it('retrieves articles with pagination and text search', async () => {
      await KnowledgeBaseService.createArticle({
        title: 'Audit Checklist for Startups',
        category: 'audit',
        tags: ['startup', 'compliance'],
        content: 'Startup checklist details',
        status: 'published'
      }, mockUser);

      await KnowledgeBaseService.createArticle({
        title: 'Payroll Compliance Rules',
        category: 'compliance',
        tags: ['payroll'],
        content: 'Payroll rules and deadlines',
        status: 'published'
      }, mockUser);

      const searchResult = await KnowledgeBaseService.getAllArticles({ q: 'Payroll' });
      expect(searchResult.articles).toHaveLength(1);
      expect(searchResult.articles[0].title).toBe('Payroll Compliance Rules');
      expect(searchResult.pagination.totalCount).toBe(1);

      const categoryResult = await KnowledgeBaseService.getAllArticles({ category: 'audit' });
      expect(categoryResult.articles).toHaveLength(1);
      expect(categoryResult.articles[0].title).toBe('Audit Checklist for Startups');
    });

    it('increments view count when requested', async () => {
      const article = await KnowledgeBaseService.createArticle({
        title: 'Company Registration Overview',
        content: 'Steps to register a company'
      }, mockUser);

      const retrieved = await KnowledgeBaseService.getArticleById(article._id.toString(), { incrementView: true });
      expect(retrieved.viewsCount).toBe(1);

      const retrievedAgain = await KnowledgeBaseService.getArticleById(article.slug, { incrementView: true });
      expect(retrievedAgain.viewsCount).toBe(2);
    });

    it('updates an article and tracks changes in audit log', async () => {
      const article = await KnowledgeBaseService.createArticle({
        title: 'Original Guide Title',
        content: 'Original content'
      }, mockUser);

      const updated = await KnowledgeBaseService.updateArticle(article._id.toString(), {
        title: 'Updated Guide Title',
        content: 'Updated content body'
      }, mockUser);

      expect(updated.title).toBe('Updated Guide Title');
      expect(updated.content).toBe('Updated content body');

      const logs = await KnowledgeLog.find({ entityId: article._id.toString(), action: 'update' });
      expect(logs).toHaveLength(1);
      expect(logs[0].details.changes).toContain('title');
      expect(logs[0].details.changes).toContain('content');
    });

    it('updates article status and records status_change log', async () => {
      const article = await KnowledgeBaseService.createArticle({
        title: 'Draft Policy',
        content: 'Draft content',
        status: 'draft'
      }, mockUser);

      const published = await KnowledgeBaseService.updateStatus(article._id.toString(), 'published', mockUser);
      expect(published.status).toBe('published');

      const logs = await KnowledgeLog.find({ entityId: article._id.toString(), action: 'status_change' });
      expect(logs).toHaveLength(1);
      expect(logs[0].details.from).toBe('draft');
      expect(logs[0].details.to).toBe('published');
    });

    it('deletes an article and records delete log', async () => {
      const article = await KnowledgeBaseService.createArticle({
        title: 'Temporary Doc',
        content: 'To be deleted'
      }, mockUser);

      const result = await KnowledgeBaseService.deleteArticle(article._id.toString(), mockUser);
      expect(result.deleted).toBe(true);

      const found = await KnowledgeBase.findById(article._id);
      expect(found).toBeNull();

      const logs = await KnowledgeLog.find({ entityId: article._id.toString(), action: 'delete' });
      expect(logs).toHaveLength(1);
    });

    it('returns categories breakdown with counts', async () => {
      await KnowledgeBaseService.createArticle({ title: 'A1', category: 'tax', content: 'c', status: 'published' }, mockUser);
      await KnowledgeBaseService.createArticle({ title: 'A2', category: 'tax', content: 'c', status: 'draft' }, mockUser);
      await KnowledgeBaseService.createArticle({ title: 'A3', category: 'audit', content: 'c', status: 'published' }, mockUser);

      const categories = await KnowledgeBaseService.getCategories();
      expect(categories).toHaveLength(2);
      const taxCat = categories.find(c => c.category === 'tax');
      expect(taxCat.count).toBe(2);
      expect(taxCat.publishedCount).toBe(1);
    });
  });

  describe('KnowledgeTaskService', () => {
    it('creates a task linked to an article and records task_created log', async () => {
      const article = await KnowledgeBaseService.createArticle({
        title: 'Article For Review',
        content: 'Needs review'
      }, mockUser);

      const task = await KnowledgeTaskService.createTask({
        title: 'Review Article Q4',
        articleId: article._id,
        taskType: 'review',
        priority: 'high',
        dueDate: '2026-12-31'
      }, mockUser);

      expect(task._id).toBeDefined();
      expect(task.title).toBe('Review Article Q4');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('high');

      const logs = await KnowledgeLog.find({ entityId: task._id.toString(), action: 'task_created' });
      expect(logs).toHaveLength(1);
      expect(logs[0].entityType).toBe('task');
    });

    it('transitions task status to completed and sets completedAt', async () => {
      const task = await KnowledgeTaskService.createTask({
        title: 'Fix Typos in Onboarding Guide',
        taskType: 'update'
      }, mockUser);

      expect(task.completedAt).toBeNull();

      const completed = await KnowledgeTaskService.updateTaskStatus(
        task._id.toString(),
        'completed',
        'All typos corrected and proofread.',
        mockUser
      );

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.resolutionNotes).toBe('All typos corrected and proofread.');

      const logs = await KnowledgeLog.find({ entityId: task._id.toString(), action: 'task_completed' });
      expect(logs).toHaveLength(1);
    });

    it('provides aggregated task statistics', async () => {
      await KnowledgeTaskService.createTask({ title: 'T1', status: 'pending', priority: 'low' }, mockUser);
      await KnowledgeTaskService.createTask({ title: 'T2', status: 'in_progress', priority: 'high' }, mockUser);
      await KnowledgeTaskService.createTask({ title: 'T3', status: 'completed', priority: 'high' }, mockUser);

      const stats = await KnowledgeTaskService.getTaskStats();
      expect(stats.total).toBe(3);
      expect(stats.status.pending).toBe(1);
      expect(stats.status.in_progress).toBe(1);
      expect(stats.status.completed).toBe(1);
      expect(stats.priority.high).toBe(2);
      expect(stats.priority.low).toBe(1);
    });
  });

  describe('Automated Maintenance Task', () => {
    it('creates periodic review tasks for stale articles', async () => {
      // Create a stale published article by setting lastReviewedAt 120 days in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 120);

      const staleArticle = await KnowledgeBase.create({
        title: 'Legacy Tax Deductions 2024',
        slug: 'legacy-tax-deductions-2024',
        content: 'Old tax rules',
        status: 'published',
        lastReviewedAt: pastDate
      });

      const results = await runMaintenance({ staleThresholdDays: 90, user: mockUser });

      expect(results.staleArticlesFound).toBe(1);
      expect(results.reviewTasksCreated).toBe(1);

      const generatedTask = await KnowledgeTask.findOne({ articleId: staleArticle._id });
      expect(generatedTask).not.toBeNull();
      expect(generatedTask.title).toContain('Periodic Review');
      expect(generatedTask.taskType).toBe('review');

      // Verify maintenance_run log
      const log = await KnowledgeLog.findOne({ action: 'maintenance_run' });
      expect(log).not.toBeNull();
      expect(log.status).toBe('success');
    });
  });

  describe('KnowledgeLogService', () => {
    it('queries logs with filters and calculates statistics', async () => {
      await KnowledgeLogService.recordManualLog({
        action: 'system_event',
        entityType: 'system',
        entityTitle: 'Database Re-indexed',
        details: { durationMs: 450 }
      }, mockUser);

      const result = await KnowledgeLogService.getAllLogs({ action: 'system_event' });
      expect(result.logs.length).toBeGreaterThanOrEqual(1);
      expect(result.logs[0].entityTitle).toBe('Database Re-indexed');

      const stats = await KnowledgeLogService.getLogStats();
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.actions.system_event).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Controllers & Azure / Node Handler Shape', () => {
    it('KnowledgeBaseController returns { status, jsonBody } shape', async () => {
      const mockRequest = {
        json: async () => ({
          title: 'Controller Test Article',
          content: 'Content from controller test'
        }),
        query: {},
        params: {}
      };
      const mockContext = { user: mockUser, error: jest.fn() };

      const response = await KnowledgeBaseController.createArticle(mockRequest, mockContext);
      expect(response.status).toBe(201);
      expect(response.jsonBody.success).toBe(true);
      expect(response.jsonBody.data.title).toBe('Controller Test Article');

      // Query article list
      const listResponse = await KnowledgeBaseController.getArticles({ query: {} }, mockContext);
      expect(listResponse.status).toBe(200);
      expect(listResponse.jsonBody.success).toBe(true);
      expect(listResponse.jsonBody.data.length).toBeGreaterThanOrEqual(1);
    });

    it('KnowledgeTaskController returns { status, jsonBody } shape', async () => {
      const mockRequest = {
        json: async () => ({
          title: 'Controller Test Task',
          taskType: 'audit'
        }),
        query: {},
        params: {}
      };
      const mockContext = { user: mockUser, error: jest.fn() };

      const response = await KnowledgeTaskController.createTask(mockRequest, mockContext);
      expect(response.status).toBe(201);
      expect(response.jsonBody.success).toBe(true);
      expect(response.jsonBody.data.title).toBe('Controller Test Task');
    });

    it('KnowledgeLogController returns { status, jsonBody } shape', async () => {
      const mockContext = { user: mockUser, error: jest.fn() };
      const response = await KnowledgeLogController.getLogs({ query: {} }, mockContext);
      expect(response.status).toBe(200);
      expect(response.jsonBody.success).toBe(true);
      expect(Array.isArray(response.jsonBody.data)).toBe(true);
    });
  });
});
