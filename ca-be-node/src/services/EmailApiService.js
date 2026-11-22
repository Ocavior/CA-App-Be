const axios = require('axios');
const nodemailer = require('nodemailer');
const { query } = require('../db/pool');
const { generateId } = require('../db/objectId');
const logger = require('../utils/logger');

const MailComposer = require('nodemailer/lib/mail-composer');

// Without EMAIL_SERVICE_URL, mail is sent as EMAIL_USER and logs are kept in
// the email_logs table instead of the external service. With GMAIL_CLIENT_ID,
// GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN set, it goes through the Gmail
// API over HTTPS; Render's free plan blocks the SMTP ports, so this is the
// path that works there. Otherwise it falls back to Gmail SMTP with a Google
// App Password in EMAIL_PASSWORD.
let transporter;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
        });
    }
    return transporter;
}

function gmailApiConfigured() {
    return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

let gmailToken = { value: null, expiresAt: 0 };
async function getGmailAccessToken() {
    if (gmailToken.value && Date.now() < gmailToken.expiresAt - 60000) return gmailToken.value;
    try {
        const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        }).toString(), { timeout: 30000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        gmailToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
        return gmailToken.value;
    } catch (error) {
        const reason = error.response?.data?.error_description || error.response?.data?.error || error.message;
        throw new Error(`Gmail authorization failed: ${reason}`);
    }
}

async function saveLog({ recipients, subject, emailMessage, status, emailDetails }) {
    try {
        await query(
            `INSERT INTO email_logs (id, app_code, email_message, recipients, subject, status, email_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [generateId(), process.env.APP_CODE || null, emailMessage || null,
             JSON.stringify(recipients), subject, status, JSON.stringify(emailDetails)]
        );
    } catch (error) {
        // A failed log write must not turn a delivered email into an error.
        logger.error('Failed to write email log:', error);
    }
}

class EmailApiService {
    static emailConfig = {
        apiUrl: process.env.EMAIL_SERVICE_URL,
        apiBaseUrl: process.env.EMAIL_SERVICE_BASE_URL,
        defaultCredentials: {
            service: 'gmail',
            user: process.env.EMAIL_USER,
            password: process.env.EMAIL_PASSWORD
        },
        timeout: 30000
    };

    // ---------- CORE SINGLE EMAIL METHOD ----------
    static async sendEmail(emailData) {
        try {
            const {
                to,
                subject,
                htmlTemplate,
                textTemplate,
                from,
                emailMessage,
                cc = null,
                bcc = null,
                attachments = null,
                emailCredentials = EmailApiService.emailConfig.defaultCredentials
            } = emailData;

            if (!to || !subject) {
                throw new Error('Missing required fields: to and subject');
            }

            if (!htmlTemplate && !textTemplate) {
                throw new Error('At least one template is required');
            }

            const payload = {
                to,
                subject,
                htmlTemplate,
                textTemplate,
                from,
                emailCredentials,
                emailMessage,
                appCode: process.env.APP_CODE
            };

            if (cc) payload.cc = cc;
            if (bcc) payload.bcc = bcc;
            if (attachments) payload.attachments = attachments;

            if (!EmailApiService.emailConfig.apiUrl) {
                return gmailApiConfigured()
                    ? await EmailApiService.sendViaGmailApi(payload)
                    : await EmailApiService.sendViaSmtp(payload);
            }

            const response = await axios.post(
                EmailApiService.emailConfig.apiUrl,
                payload,
                {
                    timeout: EmailApiService.emailConfig.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(
                    error.response.data?.message || 'Email service error'
                );
            }
            if (error.request) {
                throw new Error('Email service not responding');
            }
            throw error;
        }
    }

    static async sendViaGmailApi({ to, subject, htmlTemplate, textTemplate, from, emailMessage, cc, bcc, attachments }) {
        if (!process.env.EMAIL_USER) {
            throw new Error('Email is not configured: set EMAIL_USER');
        }
        const recipients = Array.isArray(to) ? to : [to];
        const log = { recipients, subject, emailMessage };
        try {
            const mime = await new MailComposer({
                from: from ? { name: from, address: process.env.EMAIL_USER } : process.env.EMAIL_USER,
                to: recipients,
                cc: cc || undefined,
                bcc: bcc || undefined,
                subject,
                html: htmlTemplate,
                text: textTemplate,
                attachments: attachments || undefined
            }).compile().build();
            const accessToken = await getGmailAccessToken();
            let data;
            try {
                ({ data } = await axios.post(
                    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                    { raw: mime.toString('base64url') },
                    { timeout: 30000, headers: { Authorization: `Bearer ${accessToken}` } }
                ));
            } catch (error) {
                throw new Error(`Gmail API error: ${error.response?.data?.error?.message || error.message}`);
            }
            await saveLog({ ...log, status: 'sent', emailDetails: { provider: 'gmail-api', messageId: data.id } });
            return { messageId: data.id, status: 'sent' };
        } catch (error) {
            await saveLog({ ...log, status: 'failed', emailDetails: { provider: 'gmail-api', error: error.message } });
            throw error;
        }
    }

    static async sendViaSmtp({ to, subject, htmlTemplate, textTemplate, from, emailMessage, cc, bcc, attachments }) {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            throw new Error('Email is not configured: set EMAIL_USER and EMAIL_PASSWORD');
        }
        const recipients = Array.isArray(to) ? to : [to];
        const log = { recipients, subject, emailMessage };
        try {
            // Gmail sends from EMAIL_USER whatever `from` says, so `from` is
            // only used as the display name.
            const info = await getTransporter().sendMail({
                from: from ? { name: from, address: process.env.EMAIL_USER } : process.env.EMAIL_USER,
                to: recipients,
                cc: cc || undefined,
                bcc: bcc || undefined,
                subject,
                html: htmlTemplate,
                text: textTemplate,
                attachments: attachments || undefined
            });
            await saveLog({ ...log, status: 'sent', emailDetails: { provider: 'gmail', messageId: info.messageId } });
            return { messageId: info.messageId, status: 'sent' };
        } catch (error) {
            await saveLog({ ...log, status: 'failed', emailDetails: { provider: 'gmail', error: error.message } });
            throw new Error(error.message || 'Email service error');
        }
    }

    // ---------- BULK EMAIL METHOD (CLEAN & ISOLATED) ----------
    static async sendBulkSimpleEmails({ emails, subject, message, from }) {
        if (!Array.isArray(emails) || emails.length === 0) {
            throw new Error('emails must be a non-empty array');
        }

        if (!subject || !message) {
            throw new Error('subject and message are required');
        }

        const result = {
            total: emails.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        // ---- STEP 1: FIRST EMAIL (GATE CHECK) ----
        await EmailApiService.sendEmail({
            to: emails[0],
            subject,
            htmlTemplate: `
                <div style="font-family:Arial;font-size:14px;">
                    ${message}
                    <hr/>
                    <small>© ${new Date().getFullYear()} Master brain 🧠</small>
                </div>
            `,
            textTemplate: `${message}\n\n© ${new Date().getFullYear()} Master brain 🧠`,
            from,
            emailMessage: message
        });

        result.sent++;

        // ---- STEP 2: BULK SEND ----
        for (let i = 1; i < emails.length; i++) {
            try {
                await EmailApiService.sendEmail({
                    to: emails[i],
                    subject,
                    htmlTemplate: `
                        <div style="font-family:Arial;font-size:14px;">
                            ${message}
                            <hr/>
                            <small>© ${new Date().getFullYear()} ActoFit</small>
                        </div>
                    `,
                    textTemplate: `${message}\n\n© ${new Date().getFullYear()} ActoFit`,
                    from,
                    emailMessage: message
                });

                result.sent++;
            } catch (err) {
                result.failed++;
                result.errors.push({
                    email: emails[i],
                    error: err.message
                });
            }
        }

        return result;
    }

    static async getEmailLogs(filters = {}) {
        if (!EmailApiService.emailConfig.apiBaseUrl) {
            return EmailApiService.getLocalEmailLogs(filters);
        }
        try {
            const params = {
                appCode: process.env.APP_CODE,
                ...filters
            };

            const response = await axios.get(
                `${EmailApiService.emailConfig.apiBaseUrl}/emailLogs`,
                {
                    params,
                    timeout: EmailApiService.emailConfig.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(
                    error.response.data?.message || 'Failed to fetch email logs'
                );
            }
            if (error.request) {
                throw new Error('Email service not responding');
            }
            throw error;
        }
    }

    // Same envelope as the external service's /emailLogs. Filters: page, limit, status.
    static async getLocalEmailLogs({ page, limit, status } = {}) {
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
        const where = status ? 'WHERE status = $1' : '';
        const params = status ? [status] : [];

        const { rows: [{ count }] } = await query(`SELECT count(*)::int AS count FROM email_logs ${where}`, params);
        const { rows } = await query(
            `SELECT * FROM email_logs ${where} ORDER BY created_at DESC, id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limitNum, (pageNum - 1) * limitNum]
        );

        return {
            data: {
                items: rows.map(row => ({
                    _id: row.id,
                    appCode: row.app_code ?? undefined,
                    emailMessage: row.email_message ?? undefined,
                    recipients: row.recipients,
                    subject: row.subject ?? undefined,
                    status: row.status,
                    emailDetails: row.email_details ?? undefined,
                    createdAt: row.created_at
                })),
                page: pageNum,
                limit: limitNum,
                total: count,
                hasMore: pageNum * limitNum < count
            }
        };
    }
}

module.exports = { EmailApiService };
