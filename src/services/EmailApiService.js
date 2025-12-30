const axios = require('axios');

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
                    <small>© ${new Date().getFullYear()} ActoFit</small>
                </div>
            `,
            textTemplate: `${message}\n\n© ${new Date().getFullYear()} ActoFit`,
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
}

module.exports = { EmailApiService };
