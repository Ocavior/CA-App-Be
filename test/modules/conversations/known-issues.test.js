// src/routes/conversationRoutes.js registers GET /conversations/:userId/history
// pointing at `ConversationsController.getConversationHistory` - but
// src/controllers/ConversationController.js never defines or exports that
// method, so the handler reference is `undefined`. This route DOES have
// [authenticateToken] middleware in front of it, so the registered handler
// is an ARRAY: [authenticateToken, undefined]. That produces a DIFFERENT
// failure mode than PUT /auth/change-password's equivalent bug (see
// test/modules/auth/known-issues.test.js), which has no middleware and so
// resolves to a single `undefined` handler caught by Router.handle()'s
// `if (!handler) return 404` check:
//
//   - No/invalid token: authenticateToken (handler[0]) runs first and
//     returns its own 401/403 - the undefined handler is never reached.
//   - Valid token: authenticateToken passes, then Router.handle() calls
//     `handler[handler.length - 1](request, context)` - literally invoking
//     `undefined(...)`, which throws a TypeError caught by Router.handle()'s
//     OUTER try/catch, producing a 500 "Internal server error" with the
//     TypeError's message - not a 404, and not any conversation-specific error.
const { agent, apiPath, authHeader } = require('../../helpers/apiClient');
const db = require('../../helpers/db');
const { registerAdmin } = require('../../helpers/auth');

describe('Conversations - known issues', () => {
  let token;

  beforeAll(async () => {
    await db.connect();
    ({ token } = await registerAdmin());
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('#critical - with a valid token, /history 500s (undefined handler), not 404', async () => {
    const res = await agent
      .get(apiPath('/conversations/user-1/history'))
      .set(authHeader(token));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Internal server error');
  });

  it('without a token, /history 401s before ever reaching the undefined handler', async () => {
    const res = await agent.get(apiPath('/conversations/user-1/history'));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Access token is required' });
  });
});
