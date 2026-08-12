require('dotenv').config();

const util = require('util');
const express = require('express');
const router = require('./routes');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');

// Initialize database connection
connectDB();

// setupMiddleware(app) from ./middleware is DELIBERATELY NOT called here -
// see src/middleware/index.js's own comment block and MIGRATION_NOTES.md.

const app = express();
const PORT = process.env.PORT || 3000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// Capture the raw request body as a Buffer for EVERY request regardless of
// Content-Type. The ported Router's multipart parser and every controller's
// `request.json()` call both need the same raw bytes, exactly like they got
// from Azure Functions v4's HttpRequest (which also fully buffers the body
// before the handler runs, so there's no streaming-behavior mismatch here).
app.use(express.raw({ type: () => true, limit: '20mb' }));

// Wraps a Buffer as a genuine (unconsumed) WHATWG ReadableStream, matching
// the real type of Azure Functions v4's HttpRequest.body - NOT a plain
// Buffer. This matters more than it looks: WhatsappTemplateConttroller
// .updateTemplate reads `request.body` directly and passes it straight into
// a Mongoose `$set` update (a pre-existing bug - see MIGRATION_NOTES.md). A
// real Buffer has indexed own-enumerable properties (like any TypedArray),
// and MongoDB's driver gives Buffers special BSON treatment - passed to
// `$set`, that throws "Invalid atomic update value for $set", a DIFFERENT
// failure than the real bug, which is that a stream-shaped object has NO
// enumerable own properties and so becomes a silent no-op update instead.
// Reproducing the actual bug (not a lookalike) requires actually handing
// controllers a stream-shaped object here, not a Buffer.
function bufferToReadableStream(buffer) {
  let sent = false;
  return new ReadableStream({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(new Uint8Array(buffer));
      }
      controller.close();
    }
  });
}

// Deliberately mounted with NO path pattern (not `app.all('/api/v1/*', ...)`).
// A path pattern would make Express's own path-to-regexp matcher decode the
// captured wildcard segment to test it against the pattern - which throws on
// a malformed percent-encoded path (e.g. `%zz`) BEFORE this handler ever
// runs, producing Express's default HTML error page. Under Azure Functions,
// the equivalent decodeURIComponent call happens deeper inside the ported
// Router's OWN findRoute(), which IS inside Router.handle()'s try/catch, so
// the client always gets the Router's own JSON 500 envelope instead. Mounting
// with no path means Express performs no decoding/matching of its own at
// all - the copied Router is left as the sole authority on path parsing,
// exactly as it is once a request reaches the function today, so this
// specific divergence is eliminated at the root instead of papered over with
// a second, differently-shaped error handler.
app.use(async (req, res) => {
  try {
    logger.info(`${req.method} ${req.originalUrl}`);

    if (req.method === 'OPTIONS') {
      res.status(200).set({
        ...corsHeaders(),
        'Access-Control-Max-Age': '86400'
      }).end();
      return;
    }

    // express.raw() only produces a real Buffer when the request actually
    // carries a body - for a bodyless request, req.body falls back to `{}`
    // (body-parser's default), NOT a Buffer. Normalizing here keeps
    // request.rawBody (and the multipart parser that reads it) working
    // consistently regardless.
    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    const request = {
      method: req.method,
      url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      headers: {
        get: (name) => req.headers[String(name).toLowerCase()]
      },
      body: bufferToReadableStream(bodyBuffer),
      // The ported Router's own handleFileUploads() already has a
      // `request.rawBody && Buffer.isBuffer(request.rawBody)` fallback
      // branch (see src/routes/index.js) specifically for getting a real
      // Buffer when `.body` itself isn't one - this is what the multipart
      // parser actually uses, so `.body` above is free to be stream-shaped.
      rawBody: bodyBuffer,
      // Deliberately no "empty body -> null" special case: verified against
      // a live Azure Functions host that its real request.json() actually
      // THROWS for a bodyless request (confirmed by the `.catch(() => ({}))`
      // pattern several controllers already use defensively around their
      // own request.json() calls - e.g. toggleServiceStatus in
      // ServiceController.js - and by directly observing that a bodyless
      // DELETE /ca/submissions/bulk 500s on the real host, not 400, because
      // bulkDelete has no such catch). JSON.parse('') throws SyntaxError
      // naturally, which reproduces that exactly - do not "fix" this by
      // special-casing empty input.
      json: async () => JSON.parse(bodyBuffer.toString('utf8'))
    };

    const context = {
      log: (...args) => logger.info(util.format(...args)),
      error: (...args) => logger.error(util.format(...args)),
      warn: (...args) => logger.warn(util.format(...args)),
      user: undefined
    };

    const response = await router.handle(request, context);

    res.status(response.status || 200);
    res.set({ ...response.headers, ...corsHeaders() });

    if (response.jsonBody !== undefined) {
      res.json(response.jsonBody);
    } else {
      res.end();
    }
  } catch (error) {
    logger.error('Unhandled error:', error);
    res.status(500).set(corsHeaders()).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// General safety net only - with routing handled entirely inside the
// try/catch above (see the no-path-pattern comment on `app.use` above), this
// should rarely if ever fire. It exists for genuinely unexpected Express/
// body-parser-level throws (e.g. express.raw()'s own size-limit rejection)
// that happen outside that try/catch. Uses the same envelope shape as the
// ported Router's own catch block (message/error swapped vs. the app-level
// catch above) since anything reaching this middleware is, by definition,
// something the app-level try/catch never got a chance to handle.
app.use((err, req, res, next) => {
  logger.error('Unhandled Express-level error:', err);
  res.status(500).set(corsHeaders()).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

app.listen(PORT, () => {
  logger.info(`ca-be-node listening on port ${PORT}`);
});

module.exports = app;
