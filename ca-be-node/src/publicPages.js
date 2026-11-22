// Public homepage and privacy policy. Google requires both URLs before the
// OAuth app used for sending email (see EmailApiService) can be published.
const CONTACT = 'official.masterbrains@gmail.com';

function page(title, body) {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.6;color:#222}h1{font-size:1.6em}a{color:#0b57d0}</style>
</head><body>${body}</body></html>`;
}

const home = page('CA App', `
<h1>CA App</h1>
<p>CA App is the backend for Master Brain's internal tool for managing contact details
of Chartered Accountants and sending them updates by email and WhatsApp.</p>
<p><a href="/privacy">Privacy policy</a> &middot; Contact: <a href="mailto:${CONTACT}">${CONTACT}</a></p>`);

const privacy = page('Privacy Policy - CA App', `
<h1>Privacy policy</h1>
<p>This policy covers CA App, run by Master Brain, including its use of Google account access.</p>
<h2>What we collect</h2>
<p>CA App stores contact details of Chartered Accountants (such as name, email address, phone
number, city and services offered) that our team enters or imports, plus the accounts of our
own staff who sign in to the app. We keep a log of emails the app sends (recipients, subject,
status).</p>
<h2>Use of Google user data</h2>
<p>CA App asks for one Google permission, <em>send email on your behalf</em> (the
<code>gmail.send</code> scope), only for our own sending account, ${CONTACT}. It uses it to send
emails that our staff start from the app. CA App does not read, store, or delete any Gmail
messages, and does not share Google user data with anyone or use it for advertising.</p>
<p>CA App's use of information received from Google APIs adheres to the
<a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
including the Limited Use requirements.</p>
<h2>Sharing</h2>
<p>We do not sell personal data. Data is processed only by the services that host and run the
app (our hosting and database provider, Google for sending email, and our WhatsApp messaging
provider).</p>
<h2>Your choices</h2>
<p>To ask for your details to be corrected or removed, or to stop receiving emails, write to
<a href="mailto:${CONTACT}">${CONTACT}</a>. Access granted to CA App can be removed at any time at
<a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</p>
<p>Last updated: 22 November 2026.</p>`);

function registerPublicPages(app) {
    app.get('/', (req, res) => res.type('html').send(home));
    app.get('/privacy', (req, res) => res.type('html').send(privacy));
}

module.exports = { registerPublicPages };
