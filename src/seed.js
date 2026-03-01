require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

const CaSubmission = require('./models/caData');
const { SERVICES } = require('./models/caData');

const MONGO_URI =
    'mongodb+srv://himanshu:DmnnW3cmpVk8UYNd@actofitwellness.g8gkulc.mongodb.net/ca_app_db_prod';

// ================= CONNECT =================
async function connectDB() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connected');
}

// ================= HELPERS =================
const clean = (val) => (val ? val.toString().trim() : '');

const extractServiceId = (text) => {
    const match = text.trim().match(/^(\d+)\s*\./);
    return match ? parseInt(match[1]) : null;
};

// ================= SEED =================
async function seed() {
    try {
        await connectDB();

        const filePath = path.join(
            __dirname,
            'Calling Data Collection - Rishabh (11) (1).xlsx'
        );

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        console.log(`📄 Processing ${rows.length} rows`);

        const documents = [];

        for (const row of rows) {
            if (!row['Name']) continue;

            const doc = {
                timestamp: row['Timestamp']
                    ? new Date(row['Timestamp'])
                    : new Date(),

                name: clean(row['Name']),
                mobile: clean(row['Mobile']),
                email: clean(row['Email']),
                state: clean(row['State']),
                city: clean(row['City']),
                whatsappNumber: clean(row['WhatsApp Number']),
                newEmail: clean(row['New Email']),

                foreignWhichCountry: clean(row['Which Country (writing)']),
                govtSubsidiesWhichState: clean(row['Which state (writing)']),
                otherServices: clean(row['Other Services']),

                remarks: clean(row['Remarks']),
                projectHelpDetails: clean(
                    row[
                    'If you have any project which you are unable to deliver on your own. Please give details. Our team will call you.'
                    ]
                ),
                employer: clean(
                    row[
                    'If you are in job, please write the name of the company in which you are working.'
                    ]
                ),
                formFiledBy: clean(row['Form Filed By']),
                source: 'csv_import',
                rawData: row,

                services: {},   // do not pre-initialize fully
                top3Services: []
            };

            // ======================================================
            // SERVICE DETECTION FROM EXCEL COLUMNS (1. , 2. , etc)
            // ======================================================
            Object.keys(row).forEach((column) => {
                const value = clean(row[column]);
                if (!value) return;

                const serviceId = extractServiceId(column);
                if (!serviceId) return;

                const service = SERVICES.find(s => s.id === serviceId);
                if (!service) return;

                if (!doc.services[service.key]) {
                    doc.services[service.key] = {};
                }

                doc.services[service.key].offered = true;
                doc.services[service.key].details = value;
            });

            // ======================================================
            // TOP 3 SERVICES
            // ======================================================
            if (row['Top 3 Services']) {
                const items = row['Top 3 Services'].split(',');

                items.forEach(item => {
                    const match = item.match(/(\d+)/);
                    if (!match) return;

                    const serviceId = parseInt(match[1]);
                    const service = SERVICES.find(s => s.id === serviceId);

                    if (service && !doc.top3Services.includes(service.name)) {
                        doc.top3Services.push(service.name);
                    }
                });
            }

            // ======================================================
            // SPECIAL HANDLING
            // ======================================================

            // Govt Subsidy
            if (doc.services.govtSubsidies?.offered && doc.govtSubsidiesWhichState) {
                doc.services.govtSubsidies.details =
                    doc.services.govtSubsidies.details || doc.govtSubsidiesWhichState;
            }

            // Foreign Accounting
            if (doc.foreignWhichCountry) {
                if (!doc.services.foreignAccounting) {
                    doc.services.foreignAccounting = {};
                }
                doc.services.foreignAccounting.offered = true;
            }

            // Other Services (id:24)
            if (doc.otherServices) {
                if (!doc.services.other) {
                    doc.services.other = {};
                }
                doc.services.other.offered = true;
                doc.services.other.details = doc.otherServices;
            }

            documents.push(doc);
        }

        // ================= CLEAR & INSERT =================
        await CaSubmission.deleteMany({});
        console.log('🗑 Old data cleared');

        await CaSubmission.insertMany(documents);
        console.log(`🎉 Inserted ${documents.length} records`);

        process.exit();

    } catch (err) {
        console.error('❌ Seed Error:', err);
        process.exit(1);
    }
}

seed();