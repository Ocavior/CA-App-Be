const adminAuthRoutes = require('./adminAuth');
const caSubmissionRoutes = require('./caSubmissionRoutes');
const responseWrapper = require('../utils/responseWrapper');
const notificationRoutes = require('./notifications');
const conversationRoutes = require('./conversationRoutes');
class Router {
    constructor() {
        this.routes = new Map();
        this.compiledRoutes = new Map();
        this.setupRoutes();
    }

    setupRoutes() {

        adminAuthRoutes.registerRoutes(this);
        conversationRoutes.registerRoutes(this);
        notificationRoutes.registerRoutes(this);
        caSubmissionRoutes.registerRoutes(this);
        // Health check
        this.addRoute('GET', '/health-check', this.healthCheck);

        console.log(`Total routes registered: ${this.routes.size}`);
    }

    addRoute(method, path, handler) {
        console.log(`Adding route: ${method} ${path}`);
        console.log(`Handler type: ${typeof handler}`);

        // Normalize the path
        const normalizedPath = this.normalizePath(path);
        const key = `${method}:${normalizedPath}`;

        this.routes.set(key, handler);

        // Compile the route pattern for better matching
        this.compileRoute(method, normalizedPath);
    }

    normalizePath(path) {
        // Remove trailing slash (except for root)
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        return path;
    }

    compileRoute(method, path) {
        const key = `${method}:${path}`;

        // Convert path pattern to regex and extract parameter names
        const paramNames = [];
        let regexPattern = path
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
            .replace(/:([^/]+)/g, (match, paramName) => {
                paramNames.push(paramName);
                return '([^/]+)'; // Match any characters except forward slash
            });

        // Ensure exact match by adding start and end anchors
        regexPattern = '^' + regexPattern + '$';

        const regex = new RegExp(regexPattern);

        this.compiledRoutes.set(key, {
            regex,
            paramNames,
            originalPath: path
        });

        console.log(`Compiled route: ${method} ${path} -> ${regexPattern}, params: [${paramNames.join(', ')}]`);
    }

    async handleFileUploads(request, context) {
        try {
            // Handle Azure Functions v4 headers (Headers object vs plain object)
            let contentType;
            if (request.headers && typeof request.headers.get === 'function') {
                // Azure Functions v4 Headers object
                contentType = request.headers.get('Content-Type') || request.headers.get('content-type');
            } else {
                // Fallback for plain object headers
                contentType = request.headers['Content-Type'] || request.headers['content-type'];
            }

            // Add more robust validation
            if (!contentType) {
                context.log('No Content-Type header found');
                return;
            }

            if (!contentType.includes('multipart/form-data')) {
                context.log('Content-Type is not multipart/form-data:', contentType);
                return;
            }

            context.log('Processing multipart/form-data request in router');
            context.log('Content-Type:', contentType);

            // Get the request body - should now be a Buffer from main handler processing
            let bodyBuffer;

            if (Buffer.isBuffer(request.body)) {
                bodyBuffer = request.body;
                context.log('Using processed Buffer body, size:', bodyBuffer.length);
            } else if (request.rawBody && Buffer.isBuffer(request.rawBody)) {
                bodyBuffer = request.rawBody;
                context.log('Using rawBody Buffer, size:', bodyBuffer.length);
            } else if (typeof request.body === 'string') {
                bodyBuffer = Buffer.from(request.body, 'binary');
                context.log('Converting string body to Buffer, size:', bodyBuffer.length);
            } else if (request.body instanceof ReadableStream) {
                // Fallback: if somehow the stream wasn't processed in main handler
                context.log('Found unprocessed ReadableStream, processing now...');
                bodyBuffer = await this.readStreamToBuffer(request.body);
                context.log('Converted ReadableStream to Buffer, size:', bodyBuffer.length);
            } else {
                context.error('Request body type:', typeof request.body);
                context.error('Request body constructor:', request.body?.constructor?.name);
                throw new Error('Unable to process request body - not a Buffer, string, or ReadableStream');
            }

            context.log("body buffer", bodyBuffer);

            // More robust boundary extraction
            const boundary = this.extractBoundary(contentType, context);
            if (!boundary) {
                context.error('Content-Type header:', contentType);
                throw new Error('Missing or invalid boundary in multipart/form-data');
            }


            if (!boundary) {
                context.error('Content-Type header:', contentType);
                throw new Error('Missing or invalid boundary in multipart/form-data');
            }

            context.log('Boundary found:', boundary);

            // Use parse-multipart library with error handling
            let parts;
            parts = this.parseMultipartData(bodyBuffer, boundary, context);


            if (!parts || parts.length === 0) {
                context.log('No parts found in multipart data');
                throw new Error('No files found in the request');
            }

            context.log('Found', parts.length, 'parts in multipart data');

            const files = {};
            const formData = {}; // Initialize formData object

            for (const part of parts) {
                // First determine the mimetype from the part
                let mimetype = part.type || part.contentType || 'application/octet-stream';

                // If no mimetype found, try to determine from filename
                if (!mimetype || mimetype === 'application/octet-stream') {
                    if (part.filename) {
                        const ext = part.filename.split('.').pop()?.toLowerCase();
                        switch (ext) {
                            case 'jpg':
                            case 'jpeg':
                                mimetype = 'image/jpeg';
                                break;
                            case 'png':
                                mimetype = 'image/png';
                                break;
                            case 'pdf':
                                mimetype = 'application/pdf';
                                break;
                            case 'doc':
                                mimetype = 'application/msword';
                                break;
                            case 'docx':
                                mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                break;
                            default:
                                mimetype = 'application/octet-stream';
                        }
                    }
                }

                context.log('Processing part:', {
                    filename: part.filename,
                    name: part.name,
                    type: mimetype,
                    dataSize: part.data?.length
                });

                if (part.filename) {
                    // It's a file - structure it to match controller expectations
                    const fieldName = part.name || 'file';
                    files[fieldName] = {
                        name: part.filename,
                        originalname: part.filename,
                        data: part.data,
                        mimetype: mimetype,
                        size: part.data.length
                    };
                } else if (part.name) {
                    // It's a form field - extract the text value and trim CRLF
                    const fieldValue = part.data.toString('utf8').trim();
                    formData[part.name] = fieldValue;
                    context.log(`Form field: ${part.name} = ${fieldValue}`);
                }
            }

            // Set files and form data on request
            request.files = files;
            request.formData = formData; // Add this line to set formData

            context.log('Files processed:', Object.keys(files));
            context.log('Form data processed:', Object.keys(formData));

            // Log file structure for debugging (matches controller expectations)
            if (files.file || files.documents) {
                const mainFile = files.file || files.documents;
                context.log('Main file structure:', {
                    name: mainFile.name,
                    originalname: mainFile.originalname,
                    mimetype: mainFile.mimetype,
                    size: mainFile.size,
                    hasData: !!mainFile.data
                });
            }

        } catch (error) {
            throw new Error(`File upload processing failed: ${error.message}`);
        }
    }

    // Enhanced boundary extraction method - FIXED: Added context parameter
    extractBoundary(contentType, context) {
        if (!contentType || typeof contentType !== 'string') {
            return null;
        }
        console.log("content type boundry function", contentType);
        // Look for boundary parameter in Content-Type header
        const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
        if (boundaryMatch) {
            let boundary = boundaryMatch[1].trim();
            if (context) {
                context.log("boundaryMatch ", boundaryMatch);
            }

            // Remove quotes if present
            if ((boundary.startsWith('"') && boundary.endsWith('"')) ||
                (boundary.startsWith("'") && boundary.endsWith("'"))) {
                boundary = boundary.slice(1, -1);
            }
            return boundary;
        }

        return null;
    }

    parseMultipartData(buffer, boundary, context) {
        const parts = [];
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
        context.log("parseMultipartData buffer", buffer.length, "boundary", boundary);

        let start = 0;
        let pos = 0;

        while (pos < buffer.length) {
            const boundaryPos = buffer.indexOf(boundaryBuffer, pos);
            context.log("parseMultipartData boundaryPos", boundaryPos);

            if (boundaryPos === -1) break;

            if (start > 0) {
                // Extract the part between boundaries
                const partBuffer = buffer.slice(start, boundaryPos);

                const part = this.parsePart(partBuffer, context);
                if (part) {
                    parts.push(part);
                }
            }

            start = boundaryPos + boundaryBuffer.length + 2; // +2 for \r\n
            pos = start;

            // Check if this is the end boundary
            if (buffer.indexOf(endBoundaryBuffer, boundaryPos) === boundaryPos) {
                break;
            }
        }

        return parts;
    }

    parsePart(partBuffer, context) {
        try {
            // Find the double CRLF that separates headers from body
            const headerEndPos = partBuffer.indexOf('\r\n\r\n');
            if (headerEndPos === -1) return null;

            context.log("partBuffer length", partBuffer.length);
            const headerSection = partBuffer.slice(0, headerEndPos).toString('utf8');
            let bodySection = partBuffer.slice(headerEndPos + 4);

            // Remove trailing CRLF from body section (common in multipart)
            while (bodySection.length > 0 &&
                (bodySection[bodySection.length - 1] === 0x0A || // \n
                    bodySection[bodySection.length - 1] === 0x0D)) { // \r
                bodySection = bodySection.slice(0, -1);
            }

            context.log("headerSection", headerSection);

            // Parse headers
            const headers = {};
            const headerLines = headerSection.split('\r\n');

            for (const line of headerLines) {
                const colonPos = line.indexOf(':');
                if (colonPos > 0) {
                    const key = line.slice(0, colonPos).trim().toLowerCase();
                    const value = line.slice(colonPos + 1).trim();
                    headers[key] = value;
                }
            }

            // Extract content-disposition info
            const contentDisposition = headers['content-disposition'];
            if (!contentDisposition) return null;

            const nameMatch = contentDisposition.match(/name="([^"]+)"/);
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

            const part = {
                name: nameMatch ? nameMatch[1] : null,
                filename: filenameMatch ? filenameMatch[1] : null,
                type: headers['content-type'] || null,
                contentType: headers['content-type'] || null,
                data: bodySection
            };

            context.log('Parsed part:', {
                name: part.name,
                filename: part.filename,
                type: part.type,
                dataLength: part.data.length,
                isFile: !!part.filename,
                // Show first few characters for text fields (for debugging)
                preview: !part.filename && part.data.length < 50 ?
                    part.data.toString('utf8') :
                    `${part.data.length} bytes`
            });

            return part;

        } catch (error) {
            if (context) {
                context.error('Error parsing multipart part:', error);
            }
            return null;
        }
    }


    // Helper method to read ReadableStream to Buffer (fallback)
    async readStreamToBuffer(stream) {
        const reader = stream.getReader();
        const chunks = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;

            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            return Buffer.from(result);
        } finally {
            reader.releaseLock();
        }
    }

    // In your Router class, update validateFileParts method
    validateFileParts(files) {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'application/vnd.oasis.opendocument.spreadsheet' // .ods
        ];

        const maxFileSize = 10 * 1024 * 1024; // 10MB

        for (const [fieldName, file] of Object.entries(files)) {
            if (!file.originalname) {
                throw new Error(`File in field ${fieldName} must have a filename`);
            }

            if (file.size > maxFileSize) {
                throw new Error(`File ${file.originalname} exceeds maximum size of 10MB`);
            }

            if (!allowedTypes.includes(file.mimetype)) {
                throw new Error(`File ${file.originalname} has unsupported type: ${file.mimetype}. Allowed types: PDF, Images, Word, Excel`);
            }

            if (file.originalname.length > 255) {
                throw new Error(`Filename ${file.originalname} is too long`);
            }
        }
    }

    async handle(request, context) {
        try {
            console.log(`Handling request: ${request.method} ${request.url}`);
            const method = request.method;
            const url = new URL(request.url);
            let pathname = url.pathname;

            // Remove API prefix if present
            if (pathname.startsWith('/api/v1')) {
                pathname = pathname.replace('/api/v1', '');
            }

            // Normalize pathname
            pathname = this.normalizePath(pathname);

            console.log(`Normalized pathname: ${pathname}`);

            // Find matching route
            const { handler, params } = this.findRoute(method, pathname);

            if (!handler) {
                console.log(`No route found for: ${method} ${pathname}`);
                return {
                    status: 404,
                    jsonBody: {
                        success: false,
                        message: 'Route not found'
                    }
                };
            }

            console.log(`Route matched with params:`, params);

            // Parse query parameters
            const query = {};
            for (const [key, value] of url.searchParams.entries()) {
                // Handle multiple values for the same key
                if (query[key]) {
                    if (Array.isArray(query[key])) {
                        query[key].push(value);
                    } else {
                        query[key] = [query[key], value];
                    }
                } else {
                    query[key] = value;
                }
            }

            // Add params and query to request
            request.params = params;
            request.query = query;

            // Handle file uploads for multipart/form-data requests
            await this.handleFileUploads(request, context);

            // Validate uploaded files if any
            if (request.files && Object.keys(request.files).length > 0) {
                try {
                    this.validateFileParts(request.files);
                    console.log('File validation passed');
                } catch (validationError) {
                    console.error('File validation failed:', validationError.message);
                    return {
                        status: 400,
                        jsonBody: {
                            success: false,
                            message: validationError.message
                        }
                    };
                }
            }

            console.log(`Request params:`, request.params);
            console.log(`Request query:`, request.query);
            console.log(`Request files:`, request.files ? Object.keys(request.files) : 'none');
            console.log(`Request body:`, request.body);
            console.log("handler", handler);
            // Execute middleware and handler
            if (Array.isArray(handler)) {
                // Handle middleware chain
                for (let i = 0; i < handler.length - 1; i++) {
                    const middlewareResult = await handler[i](request, context);
                    if (middlewareResult && middlewareResult.status !== 200) {
                        return middlewareResult;
                    }
                }
                // Execute final handler
                return await handler[handler.length - 1](request, context);
            } else {
                // Single handler
                return await handler(request, context);
            }

        } catch (error) {
            console.error('Router error:', error);
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    message: 'Internal server error',
                    error: error.message
                }
            };
        }
    }

    findRoute(method, pathname) {
        // Try exact match first (for static routes)
        const exactKey = `${method}:${pathname}`;
        if (this.routes.has(exactKey)) {
            return { handler: this.routes.get(exactKey), params: {} };
        }

        // Try pattern matching using compiled routes
        for (const [key, compiledRoute] of this.compiledRoutes.entries()) {
            const [routeMethod] = key.split(':');
            if (routeMethod !== method) continue;

            const match = pathname.match(compiledRoute.regex);
            if (match) {
                const params = {};

                // Extract parameters from the match
                for (let i = 0; i < compiledRoute.paramNames.length; i++) {
                    const paramName = compiledRoute.paramNames[i];
                    const paramValue = match[i + 1]; // match[0] is the full match
                    params[paramName] = decodeURIComponent(paramValue);
                }

                console.log(`Route matched: ${key}, extracted params:`, params);
                return { handler: this.routes.get(key), params };
            }
        }

        return { handler: null, params: {} };
    }

    // Legacy method for backward compatibility
    matchPath(pattern, pathname) {
        // Normalize both paths
        pattern = this.normalizePath(pattern);
        pathname = this.normalizePath(pathname);

        const patternParts = pattern.split('/').filter(part => part !== '');
        const pathParts = pathname.split('/').filter(part => part !== '');

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];

            if (patternPart.startsWith(':')) {
                const paramName = patternPart.slice(1);
                params[paramName] = decodeURIComponent(pathPart);
            } else if (patternPart.toLowerCase() !== pathPart.toLowerCase()) {
                return null;
            }
        }

        return params;
    }

    async healthCheck(request, context) {
        return responseWrapper.success({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    }

    // Method to list all registered routes (useful for debugging)
    listRoutes() {
        console.log('\n=== Registered Routes ===');
        const routesByPrefix = {};

        for (const [key] of this.routes.entries()) {
            const [method, path] = key.split(':');
            const prefix = path.split('/')[1] || 'root';

            if (!routesByPrefix[prefix]) {
                routesByPrefix[prefix] = [];
            }
            routesByPrefix[prefix].push(`${method} ${path}`);
        }

        Object.keys(routesByPrefix).sort().forEach(prefix => {
            console.log(`\n${prefix.toUpperCase()}:`);
            routesByPrefix[prefix].sort().forEach(route => {
                console.log(`  ${route}`);
            });
        });

        console.log(`\nTotal: ${this.routes.size} routes`);
        console.log(`Compiled: ${this.compiledRoutes.size} patterns\n`);
    }

    // Debug method to test route matching
    testRoute(method, path) {
        console.log(`\n=== Testing Route: ${method} ${path} ===`);
        const result = this.findRoute(method, path);
        console.log('Result:', result);
        return result;
    }
}

module.exports = new Router();