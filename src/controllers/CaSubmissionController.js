// controllers/CaSubmissionController.js
const { importFromExcel, createCaSubmission, updateCaSubmission } = require('../services/CaSubmissionImportService');
const CaSubmission = require('../models/caData');
const { SERVICES } = require('../models/caData');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mongoose = require('mongoose');
const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
/**
 * Import Excel file with CA submissions
 * POST /ca/import
 * Upload file with field name "file" or "documents"
 */
async function importExcel(request, context) {
  try {
    // Check if files were uploaded
    if (!request.files || Object.keys(request.files).length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'No file uploaded. Please upload an Excel file with field name "file" or "documents".'
        }
      };
    }

    // Get the file - check both 'file' and 'documents' field names
    const uploadedFile = request.files.file || request.files.documents || Object.values(request.files)[0];

    if (!uploadedFile || !uploadedFile.data) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Invalid file upload. File data is missing.'
        }
      };
    }

    context.log('Processing file:', {
      name: uploadedFile.originalname,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    });

    // Validate file type - should be Excel
    const validExcelTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.oasis.opendocument.spreadsheet' // .ods
    ];

    if (!validExcelTypes.includes(uploadedFile.mimetype)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: `Invalid file type. Expected Excel file (.xlsx, .xls), got ${uploadedFile.mimetype}`
        }
      };
    }

    // Process the Excel file
    const result = await importFromExcel({
      buffer: uploadedFile.data,
      upsert: true
    });

    context.log('Import completed:', result);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: result.message || 'File imported successfully',
        data: result
      }
    };

  } catch (err) {
    context.error('Import error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to import file',
        error: err.message
      }
    };
  }
}

/**
 * Get all CA submissions with pagination and filtering
 * GET /ca/submissions
 * Query params:
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 10, max: 100)
 *   - sortBy: field to sort by (default: createdAt)
 *   - sortOrder: asc or desc (default: desc)
 *   - name: filter by name (partial match)
 *   - mobile: filter by mobile (exact match)
 *   - email: filter by email (partial match)
 *   - state: filter by state (exact match)
 *   - city: filter by city (exact match)
 *   - services: filter by services offered (comma-separated service keys)
 *   - source: filter by source (manual, csv_import, api, web_form)
 *   - startDate: filter by timestamp start date
 *   - endDate: filter by timestamp end date
 */
async function getSubmissions(request, context) {
  try {
    const query = request.query || {};

    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 10, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Build filter query
    const filter = {};

    // Name filter (case-insensitive partial match)
    if (query.name) {
      filter.name = { $regex: query.name, $options: 'i' };
    }

    // Mobile filter (exact match)
    if (query.mobile) {
      filter.mobile = query.mobile;
    }

    // Email filter (case-insensitive partial match)
    if (query.email) {
      filter.email = { $regex: query.email, $options: 'i' };
    }

    // State filter (exact match, case-insensitive)
    if (query.state) {
      filter.state = { $regex: `^${query.state}$`, $options: 'i' };
    }

    // City filter (exact match, case-insensitive)
    if (query.city) {
      filter.city = { $regex: `^${query.city}$`, $options: 'i' };
    }

    // Source filter
    if (query.source) {
      filter.source = query.source;
    }

    // Date range filters
    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) {
        filter.timestamp.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.timestamp.$lte = new Date(query.endDate);
      }
    }

    // Service filters - NEW: works with services.{key}.offered structure
    if (query.services) {
      const services = query.services.split(',').map(s => s.trim());
      services.forEach(serviceKey => {
        filter[`services.${serviceKey}.offered`] = true;
      });
    }

    // Employer filter
    if (query.employer) {
      filter.employer = { $regex: query.employer, $options: 'i' };
    }

    // Execute query
    const [submissions, totalCount] = await Promise.all([
      CaSubmission.find(filter)
        .select('-rawData') // Exclude raw data from response
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      CaSubmission.countDocuments(filter)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submissions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          applied: Object.keys(query).filter(k => !['page', 'limit', 'sortBy', 'sortOrder'].includes(k))
        }
      }
    };

  } catch (err) {
    context.error('Get submissions error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch submissions',
        error: err.message
      }
    };
  }
}

/**
 * Get a single CA submission by ID
 * GET /ca/submissions/:id
 */
async function getSubmissionById(request, context) {
  try {
    const { id } = request.params;

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Submission ID is required'
        }
      };
    }

    const submission = await CaSubmission.findById(id)
      .select('-rawData')
      .lean();

    if (!submission) {
      return {
        status: 404,
        jsonBody: {
          success: false,
          message: 'Submission not found'
        }
      };
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submission
      }
    };

  } catch (err) {
    context.error('Get submission by ID error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch submission',
        error: err.message
      }
    };
  }
}

async function searchSubmissions(request, context) {
  try {
    const query = request.query || {};

    // ---------------- HELPERS ----------------
    const decodeParam = (param) => {
      if (!param) return param;
      if (Array.isArray(param)) {
        param = param.find(p => typeof p === 'string' && p.trim()) || '';
      }
      if (typeof param !== 'string') return '';
      try {
        return decodeURIComponent(param.trim());
      } catch (e) {
        context.warn('Failed to decode parameter:', param, e);
        return param.trim();
      }
    };

    const escapeRegex = (str) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ---------------- PARAMS ----------------
    const searchQuery = decodeParam(query.q);
    const state = decodeParam(query.state);
    const city = decodeParam(query.city);
    const servicesParam = decodeParam(query.services);
    const startDate = query.startDate;
    const endDate = query.endDate;
    const isActive = query.isActive;
    const employerAvailable = query.employerAvailable;

    // ---------------- FILTER ----------------
    const filter = {};
    filter.$and = [];

    // -------- TEXT SEARCH --------
    if (searchQuery) {
      const escapedQuery = escapeRegex(searchQuery);
      const fuzzyPattern = escapedQuery.split('').join('[\\s\\-\\.]*');
      const searchRegex = new RegExp(fuzzyPattern, 'i');
      const orConditions = [
        { name: searchRegex },
        { email: searchRegex },
        { newEmail: searchRegex },
        { mobile: searchRegex },
        { whatsappNumber: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
        { remarks: searchRegex },
        { otherServices: searchRegex },
        { employer: searchRegex }
      ];

      // Special case: "other" or "others"
      if (['other', 'others'].includes(searchQuery.toLowerCase())) {
        orConditions.push({ otherServices: { $exists: true, $regex: /\S/ } });
      }

      // Add conditions for each service
      SERVICES.forEach(service => {
        // 1. If the searchQuery itself matches the service name, include anyone who offers it
        const serviceNameRegex = new RegExp(escapedQuery, 'i');
        if (serviceNameRegex.test(service.name)) {
          orConditions.push({ [`services.${service.key}.offered`]: true });
        }

        // 2. Also keep the existing logic that searches inside service details
        orConditions.push({
          [`services.${service.key}.details`]: {
            $regex: new RegExp(
              `(?:^|,)\\s*(${escapedQuery})\\s*(?:,|$)`,
              'i'
            )
          }
        });
      });

      filter.$and.push({ $or: orConditions });
    }

    // -------- STATE / CITY --------
    if (state) {
      filter.$and.push({ state: new RegExp(escapeRegex(state), 'i') });
    }

    if (city) {
      filter.$and.push({ city: new RegExp(escapeRegex(city), 'i') });
    }

    // -------- SERVICES + SUBSERVICES (FIXED) --------
    if (servicesParam) {
      const serviceEntries = servicesParam.split(',').map(s => s.trim());

      serviceEntries.forEach(entry => {
        const [serviceKey, subServiceRaw] = entry.split(':');

        // Special case: other
        if (serviceKey === 'other') {
          filter.$and.push({
            otherServices: { $regex: /\S/ }
          });
          return;
        }

        const condition = {
          [`services.${serviceKey}.offered`]: true
        };

        if (subServiceRaw) {
          const subServices = subServiceRaw
            .split('|')
            .map(s => escapeRegex(s.trim()));

          const subServiceRegex = new RegExp(
            `(?:^|,)\\s*(${subServices.join('|')})\\s*(?:,|$)`,
            'i'
          );

          condition[`services.${serviceKey}.details`] = {
            $regex: subServiceRegex
          };
        }

        filter.$and.push(condition);
      });
    }

    // -------- DATE RANGE --------
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.$and.push({ timestamp: dateFilter });
    }

    // -------- ACTIVE --------
    if (isActive !== undefined) {
      filter.$and.push({
        isActive: isActive === 'true' || isActive === true
      });
    }

    // -------- EMPLOYER AVAILABLE --------
    if (employerAvailable !== undefined) {
      const wantsEmployer = employerAvailable === 'true' || employerAvailable === true;

      if (wantsEmployer) {
        filter.$and.push({
          employer: { $exists: true, $regex: '\\S' }
        });
      } else {
        filter.$and.push({
          $or: [
            { employer: { $exists: false } },
            { employer: null },
            { employer: '' },
            { employer: { $regex: '^\\s*$' } }
          ]
        });
      }
    }

    // Cleanup empty $and
    if (filter.$and.length === 0) delete filter.$and;

    // ---------------- PAGINATION ----------------
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    let submissions;
    let totalCount;

    // ---------------- RELEVANCE SCORING (when searchQuery present) ----------------
    // Score breakdown per text field (higher = better match):
    //   4 – a complete word in the field EXACTLY equals the query
    //       ("aman", "aman singh" → word "aman" matches exactly)
    //   3 – a word in the field STARTS WITH the query but is longer
    //       ("amandeep", "amandeep singh" → word "amandeep" starts with "aman")
    //   2 – query appears anywhere in the field (e.g. "raman", "naman")
    //   0 – no match
    //
    // _relevanceScore = MAX score across all searched text fields.

    if (searchQuery) {
      const escapedQ = escapeRegex(searchQuery);

      // Regex: a complete word exactly equals the query (surrounded by word boundaries)
      // e.g. "aman" matches in "aman singh" but NOT in "amandeep"
      const exactWordRegex = new RegExp(`(?:^|[\\s\\-,])${escapedQ}(?=[\\s\\-,]|$)`, 'i');

      // Regex: a word STARTS WITH the query (could be a longer word like "amandeep")
      const wordStartRegex = new RegExp(`(?:^|[\\s\\-,])${escapedQ}`, 'i');

      // Regex: query appears anywhere in the field (fuzzy fallback — "raman", "naman")
      const anywhereRegex = new RegExp(escapedQ.split('').join('[\\s\\-\\.]*'), 'i');

      // Helper that produces a $switch expression scoring one string field
      const scoreField = (fieldPath) => ({
        $switch: {
          branches: [
            // Exact whole-word match — highest priority
            {
              case: { $regexMatch: { input: { $ifNull: [`$${fieldPath}`, ''] }, regex: exactWordRegex } },
              then: 4
            },
            // A word starts with the query (but is longer, e.g. "amandeep")
            {
              case: { $regexMatch: { input: { $ifNull: [`$${fieldPath}`, ''] }, regex: wordStartRegex } },
              then: 3
            },
            // Query appears anywhere in the field
            {
              case: { $regexMatch: { input: { $ifNull: [`$${fieldPath}`, ''] }, regex: anywhereRegex } },
              then: 2
            }
          ],
          default: 0
        }
      });

      // ---- PRIORITY fields: name, email, service details, otherServices ----
      // A match here always outranks a match that only touches secondary fields.
      const primaryFields = [
        'name', 'email', 'newEmail',
        'otherServices',
        ...SERVICES.map(s => `services.${s.key}.details`)
      ];

      // ---- SECONDARY fields: location, contact, freetext ----
      const secondaryFields = [
        'mobile', 'whatsappNumber',
        'city', 'state',
        'remarks', 'employer'
      ];

      const scoringPipeline = [
        { $match: filter },
        {
          $addFields: {
            // Best match quality score across primary fields
            _primaryScore: { $max: primaryFields.map(f => scoreField(f)) },
            // Best match quality score across secondary fields
            _secondaryScore: { $max: secondaryFields.map(f => scoreField(f)) }
          }
        },
        // Sort: primary match first, then secondary, then newest
        { $sort: { _primaryScore: -1, _secondaryScore: -1, timestamp: -1 } },
        { $project: { rawData: 0 } }
      ];

      if (skip === 0) {
        const [results, count] = await Promise.all([
          CaSubmission.aggregate([
            ...scoringPipeline,
            { $limit: limit }
          ]),
          CaSubmission.countDocuments(filter)
        ]);
        submissions = results;
        totalCount = count;
      } else {
        submissions = await CaSubmission.aggregate([
          ...scoringPipeline,
          { $skip: skip },
          { $limit: limit }
        ]);
        totalCount = null;
      }
    } else {
      // No searchQuery – use the fast find() path (unchanged behaviour)
      const projection = { rawData: 0 };
      const sort = { timestamp: -1 };

      if (skip === 0) {
        [submissions, totalCount] = await Promise.all([
          CaSubmission.find(filter, projection).sort(sort).limit(limit).lean(),
          CaSubmission.countDocuments(filter)
        ]);
      } else {
        submissions = await CaSubmission.find(filter, projection)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean();
        totalCount = null;
      }
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submissions,
        pagination: {
          currentPage: page,
          totalPages: totalCount ? Math.ceil(totalCount / limit) : null,
          totalCount,
          limit,
          hasNextPage: submissions.length === limit,
          hasPrevPage: page > 1
        }
      }
    };

  } catch (err) {
    context.error('Search submissions error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Search failed',
        error: err.message
      }
    };
  }
}



/**
 * Get aggregated statistics
 * GET /ca/stats
 */
async function getStats(request, context) {
  try {
    const [
      totalSubmissions,
      submissionsByState,
      submissionsByCity,
      submissionsBySource,
      topServices
    ] = await Promise.all([
      // Total count
      CaSubmission.countDocuments(),

      // Group by state
      CaSubmission.aggregate([
        {
          $project: {
            stateNormalized: { $toLower: { $trim: { input: "$state" } } }
          }
        },
        {
          $group: {
            _id: "$stateNormalized",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),


      // Group by city
      CaSubmission.aggregate([
        {
          $project: {
            cityNormalized: { $toLower: { $trim: { input: "$city" } } }
          }
        },
        {
          $group: {
            _id: "$cityNormalized",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Group by source
      CaSubmission.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Count services offered - NEW: works with services.{key}.offered structure
      CaSubmission.aggregate([
        {
          $facet: {
            // ---------------- NORMAL SERVICES ----------------
            structuredServices: [
              {
                $project: {
                  servicesArray: { $objectToArray: '$services' }
                }
              },
              { $unwind: '$servicesArray' },
              {
                $match: {
                  'servicesArray.v.offered': true
                }
              },
              {
                $group: {
                  _id: '$servicesArray.k',
                  count: { $sum: 1 }
                }
              }
            ],

            // ---------------- OTHER SERVICES ----------------
            otherServices: [
              {
                $match: {
                  otherServices: { $regex: /\S/ } // exists & not empty
                }
              },
              {
                $group: {
                  _id: 'other',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        },

        // ---------------- MERGE RESULTS ----------------
        {
          $project: {
            merged: { $concatArrays: ['$structuredServices', '$otherServices'] }
          }
        },
        { $unwind: '$merged' },
        { $replaceRoot: { newRoot: '$merged' } },

        // ---------------- SORT ----------------
        { $sort: { count: -1 } }
      ])
    ]);

    // Get average service count per CA
    const avgServicesResult = await CaSubmission.aggregate([
      {
        $project: {
          serviceCount: {
            $size: {
              $filter: {
                input: { $objectToArray: '$services' },
                as: 'service',
                cond: { $eq: ['$$service.v.offered', true] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          avgServices: { $avg: '$serviceCount' },
          maxServices: { $max: '$serviceCount' },
          minServices: { $min: '$serviceCount' }
        }
      }
    ]);

    const avgServices = avgServicesResult[0] || { avgServices: 0, maxServices: 0, minServices: 0 };

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          totalSubmissions,
          byState: submissionsByState,
          byCity: submissionsByCity,
          bySource: submissionsBySource,
          topServices,
          serviceStats: {
            averageServicesPerCA: Math.round(avgServices.avgServices * 10) / 10,
            maxServicesOffered: avgServices.maxServices,
            minServicesOffered: avgServices.minServices
          }
        }
      }
    };

  } catch (err) {
    context.error('Get stats error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch statistics',
        error: err.message
      }
    };
  }
}

/**
 * Get service-specific statistics
 * GET /ca/stats/services
 * Returns detailed stats about each service
 */
async function getServiceStats(request, context) {
  try {
    // Total docs (you can add { isActive: true } if needed)
    const totalCAs = await CaSubmission.countDocuments();

    // Uses the static method defined on the schema
    const statsByName = await CaSubmission.getServiceStats();

    const detailedStats = await Promise.all(
      SERVICES.map(async (service) => {
        const count = statsByName[service.name] || 0;

        const sampleCAs = await CaSubmission.find({
          [`services.${service.key}.offered`]: true
        })
          .select('name city state')
          .limit(5)
          .lean();

        const percentage =
          totalCAs > 0
            ? Number(((count / totalCAs) * 100).toFixed(1))
            : 0;

        return {
          id: service.id,
          name: service.name,
          key: service.key,
          count,
          percentage,
          sampleCAs
        };
      })
    );

    // Sort by count desc
    detailedStats.sort((a, b) => b.count - a.count);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          services: detailedStats,
          totalCAs
        }
      }
    };
  } catch (err) {
    context.error('Get service stats error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch service statistics',
        error: err.message
      }
    };
  }
}

/**
 * Get CAs by service
 * GET /ca/by-service/:serviceKey
 * Query params:
 *   - page, limit, state, city (same as getSubmissions)
 */
async function getByService(request, context) {
  try {
    const { serviceKey } = request.params;
    const query = request.query || {};

    if (!serviceKey) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Service key is required'
        }
      };
    }

    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {
      [`services.${serviceKey}.offered`]: true
    };

    // Add optional filters
    if (query.state) {
      filter.state = { $regex: `^${query.state}$`, $options: 'i' };
    }
    if (query.city) {
      filter.city = { $regex: `^${query.city}$`, $options: 'i' };
    }

    // Execute query
    const [submissions, totalCount] = await Promise.all([
      CaSubmission.find(filter)
        .select('-rawData')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CaSubmission.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: submissions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filter: {
          serviceKey,
          state: query.state,
          city: query.city
        }
      }
    };

  } catch (err) {
    context.error('Get by service error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch submissions by service',
        error: err.message
      }
    };
  }
}

/**
 * Delete a submission by ID
 * DELETE /ca/submissions/:id
 */
async function deleteSubmission(request, context) {
  try {
    const { id } = request.params;

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Submission ID is required'
        }
      };
    }

    const result = await CaSubmission.findByIdAndDelete(id);

    if (!result) {
      return {
        status: 404,
        jsonBody: {
          success: false,
          message: 'Submission not found'
        }
      };
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Submission deleted successfully'
      }
    };

  } catch (err) {
    context.error('Delete submission error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to delete submission',
        error: err.message
      }
    };
  }
}

/**
 * Create a new CA submission manually
 * POST /ca/submissions
 */
async function createSubmission(request, context) {
  try {
    const payload = (await request.json()) || {};

    // Basic validation: require at least a name
    if (!payload.name || !String(payload.name).trim()) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Name is required to create a CA submission'
        }
      };
    }

    const submission = await createCaSubmission(payload);

    return {
      status: 201,
      jsonBody: {
        success: true,
        message: 'CA submission created successfully',
        data: submission
      }
    };
  } catch (err) {
    context.error('Create submission error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to create submission',
        error: err.message
      }
    };
  }
}

/**
 * Update an existing CA submission
 * PUT /ca/submissions/:id
 */
async function updateSubmission(request, context) {
  try {
    const { id } = request.params;
    const payload = (await request.json()) || {};

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Submission ID is required'
        }
      };
    }

    const updated = await updateCaSubmission(id, payload);

    if (!updated) {
      return {
        status: 404,
        jsonBody: {
          success: false,
          message: 'Submission not found'
        }
      };
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Submission updated successfully',
        data: updated
      }
    };
  } catch (err) {
    context.error('Update submission error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to update submission',
        error: err.message
      }
    };
  }
}

/**
 * Bulk delete submissions
 * DELETE /ca/submissions/bulk
 * Body: { ids: ['id1', 'id2', ...] }
 */
async function bulkDelete(request, context) {
  try {
    const { ids } = (await request.json()) || {};

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Array of IDs is required'
        }
      };
    }

    const result = await CaSubmission.deleteMany({ _id: { $in: ids } });

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `Successfully deleted ${result.deletedCount} submissions`,
        deletedCount: result.deletedCount
      }
    };

  } catch (err) {
    context.error('Bulk delete error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to delete submissions',
        error: err.message
      }
    };
  }
}

async function toggleActiveStatus(request, context) {
  try {
    const { id } = request.params;  // ID from route
    const payload = (await request.json()) || {};
    const { isActive } = payload;

    // Call service to toggle or force value
    const updated = await toggleCaActive(id, isActive);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `CA is now ${updated.isActive ? 'active' : 'inactive'}`,
        data: {
          id: updated._id,
          isActive: updated.isActive
        }
      }
    };
  } catch (err) {
    context.error('Toggle isActive error:', err);

    return {
      status: err.statusCode || (err.name === 'CastError' ? 400 : 500),
      jsonBody: {
        success: false,
        message:
          err.statusCode === 404
            ? 'CA submission not found'
            : err.name === 'CastError'
              ? 'Invalid submission ID'
              : 'Failed to update CA status'
      }
    };
  }
}

async function validateCaContacts(request, context) {
  try {
    const payload = (await request.json()) || {};
    const { ids, validationType } = payload;

    // ---------- Validation ----------
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'ids must be a non-empty array'
        }
      };
    }

    if (!['email', 'whatsapp'].includes(validationType)) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'validationType must be either email or whatsapp'
        }
      };
    }

    const validIds = ids.filter(id =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validIds.length === 0) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'No valid CA IDs provided'
        }
      };
    }

    // ---------- Fetch CAs ----------
    const cas = await CaSubmission.find(
      { _id: { $in: validIds } },
      'name email newEmail whatsappNumber mobile'
    ).lean();

    // ---------- Validation Logic ----------
    const results = cas.map(ca => {
      let value = null;
      let isValid = false;

      if (validationType === 'email') {
        value = ca.email || ca.newEmail || null;
        isValid = value ? EMAIL_REGEX.test(value) : false;
      }

      if (validationType === 'whatsapp') {
        value = ca.whatsappNumber || ca.mobile || null;
        isValid = value ? PHONE_REGEX.test(value) : false;
      }

      return {
        id: ca._id,
        name: ca.name,
        value,
        status: value
          ? (isValid ? 'valid' : 'invalid')
          : 'missing'
      };
    });

    // ---------- Summary ----------
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      missing: results.filter(r => r.status === 'missing').length
    };

    return {
      status: 200,
      jsonBody: {
        success: true,
        validationType,
        summary,
        data: results
      }
    };
  } catch (err) {
    context.error('Validate CA contacts error:', err);

    return {
      status: err.name === 'CastError' ? 400 : 500,
      jsonBody: {
        success: false,
        message:
          err.name === 'CastError'
            ? 'Invalid CA ID'
            : 'Failed to validate CA contacts'
      }
    };
  }
}

/**
 * Get master list of services and sub-services
 * GET /ca/master-services
 */
async function getMasterServices(request, context) {
  try {
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: SERVICES
      }
    };
  } catch (err) {
    context.error('Get master services error:', err);
    return {
      status: 500,
      jsonBody: {
        success: false,
        message: 'Failed to fetch master services',
        error: err.message
      }
    };
  }
}

module.exports = {
  importExcel,
  getSubmissions,
  getSubmissionById,
  searchSubmissions,
  getStats,
  getServiceStats,
  getByService,
  deleteSubmission,
  createSubmission,
  updateSubmission,
  bulkDelete,
  toggleActiveStatus,
  validateCaContacts,
  getMasterServices
};