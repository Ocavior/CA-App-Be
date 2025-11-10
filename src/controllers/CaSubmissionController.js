// controllers/CaSubmissionController.js
const { importFromExcel } = require('../services/CaSubmissionImportService');
const CaSubmission = require('../models/caData');

/**
 * Import Excel file with CA submissions
 * POST /ca/import
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
 *   - services: filter by service flags (comma-separated)
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
    
    // Service flags filter
    if (query.services) {
      const services = query.services.split(',').map(s => s.trim());
      services.forEach(service => {
        filter[`serviceFlags.${service}`] = true;
      });
    }
    
    // Employer filter
    if (query.employer) {
      filter.employer = { $regex: query.employer, $options: 'i' };
    }
    
    // Execute query
    const [submissions, totalCount] = await Promise.all([
      CaSubmission.find(filter)
        .select('-rawRow') // Exclude raw row data from response
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
    
    const submission = await CaSubmission.findById(id).lean();
    
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
        .select('-rawRow')
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
      topServices
    ] = await Promise.all([
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
      
      // Count service flags
      CaSubmission.aggregate([
        {
          $project: {
            services: { $objectToArray: '$serviceFlags' }
          }
        },
        { $unwind: '$services' },
        {
          $match: {
            'services.v': true
          }
        },
        {
          $group: {
            _id: '$services.k',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          totalSubmissions,
          byState: submissionsByState,
          byCity: submissionsByCity,
          topServices
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

module.exports = {
  importExcel,
  getSubmissions,
  getSubmissionById,
  searchSubmissions,
  getStats,
  deleteSubmission
};