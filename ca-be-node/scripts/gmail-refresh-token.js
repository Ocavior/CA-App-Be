#!/usr/bin/env node
// One-time helper: gets a Gmail API refresh token for sending as EMAIL_USER.
//
// 1. In Google Cloud, enable the Gmail API and create an OAuth client of type
//    "Desktop app". Publish the OAuth consent screen ("In production"):
//    refresh tokens from an app left in "Testing" stop working after 7 days.
// 2. Run: GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-refresh-token.js
// 3. Open the printed URL, sign in as the sending account and allow access.
// 4. Put GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and the printed
//    GMAIL_REFRESH_TOKEN in the server's environment.
const http = require('http');
const axios = require('axios');

const { GMAIL_CLIENT_ID: clientId, GMAIL_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.');
    process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}`;
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline',
    prompt: 'consent'
});

const server = http.createServer(async (req, res) => {
    const params = new URL(req.url, redirectUri).searchParams;
    const code = params.get('code');
    if (!code) {
        res.end(params.get('error') ? `Authorization failed: ${params.get('error')}` : 'Waiting for authorization.');
        return;
    }
    try {
        const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirectUri, grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (!data.refresh_token) throw new Error('No refresh token returned; remove the app at myaccount.google.com/permissions and retry.');
        res.end('Done. You can close this tab and go back to the terminal.');
        console.log(`\nGMAIL_REFRESH_TOKEN=${data.refresh_token}\n`);
    } catch (error) {
        res.end('Token exchange failed; see the terminal.');
        console.error('Token exchange failed:', error.response?.data || error.message);
        process.exitCode = 1;
    }
    server.close();
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('Open this URL, sign in as the sending Gmail account, and allow access:\n');
    console.log(authUrl);
});
