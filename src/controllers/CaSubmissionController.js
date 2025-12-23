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

/**
 * Search CA submissions using text search
 * GET /ca/search
 * Query params:
 *   - q: search query (required)
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 10, max: 100)
 */
async function searchSubmissions(request, context) {
  try {
    const query = request.query || {};
    const searchQuery = query.q;

    if (!searchQuery || !searchQuery.trim()) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          message: 'Search query (q) is required'
        }
      };
    }

    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    // Text search
    const [submissions, totalCount] = await Promise.all([
      CaSubmission.find(
        { $text: { $search: searchQuery } },
        { score: { $meta: 'textScore' } }
      )
        .select('-rawData')
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean(),
      CaSubmission.countDocuments({ $text: { $search: searchQuery } })
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
        search: {
          query: searchQuery
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
        { $group: { _id: '$state', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Group by city
      CaSubmission.aggregate([
        { $group: { _id: '$city', count: { $sum: 1 } } },
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
        },
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
  validateCaContacts
};