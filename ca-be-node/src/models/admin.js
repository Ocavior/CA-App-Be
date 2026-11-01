const { defineModel } = require('../db/model');
const { castDocument, castUpdate, duplicateKeyError } = require('./schemaSupport');

const base = defineModel({
    modelName: 'Admin',
    table: 'admins',
    columns: {
        username: { column: 'username', type: 'text' },
        password: { column: 'password', type: 'text' },
        email: { column: 'email', type: 'text' },
        phoneNumber: { column: 'phone_number', type: 'text' },
        applicationCode: { column: 'application_code', type: 'text' },
        isActive: { column: 'is_active', type: 'bool' },
        role: { column: 'role', type: 'text' }
    }
});

const schema = {
    username: { type: 'string', required: true, trim: true },
    password: { type: 'string', required: true },
    email: { type: 'string', required: true, trim: true, lowercase: true },
    phoneNumber: { type: 'string' },
    applicationCode: { type: 'string', default: 'CaApp' },
    isActive: { type: 'boolean' },
    role: { type: 'string', enum: ['admin', 'operational'], required: true, default: 'operational' }
};

const rethrow = (err) => { throw duplicateKeyError(err, 'admins', base.fields); };

module.exports = {
    ...base,

    create(input) {
        return base.insert(castDocument('Admin', schema, input)).catch(rethrow);
    },

    updateById(id, changes, options) {
        return base.updateById(id, castUpdate('Admin', schema, changes), options).catch(rethrow);
    }
};
