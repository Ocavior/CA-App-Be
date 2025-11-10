require('dotenv').config();
module.exports = {
    // MongoDB
    mongodbUri: process.env.MONGODB_URI,
    API_VERSION: process.env.API_VERSION,
    APP_NAME: process.env.APP_NAME,
    // Server
    port: process.env.PORT || 3000,

    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRE : process.env.JWT_EXPIRE,
    SALT_ROUNDS : process.env.SALT_ROUNDS,
    AZURE_ENDPOINT : process.env.AZURE_ENDPOINT,
    AZURE_API_KEY : process.env.AZURE_API_KEY,
    AZURE_DEPLOYMENT_NAME : process.env.AZURE_DEPLOYMENT_NAME,
    AZURE_API_VERSION : process.env.AZURE_API_VERSION,
    maxFileSizeMB: 5, // Maximum file size for uploads in MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],

    // GCP tokens
    gcp_type: process.env.gcp_type,
    gcp_project_id: process.env.gcp_project_id,
    gcp_private_key_id: process.env.gcp_private_key_id,
    gcp_private_key: process.env.gcp_private_key,
    gcp_client_email: process.env.gcp_client_email,
    gcp_client_id: process.env.gcp_client_id,
    gcp_auth_uri: process.env.gcp_auth_uri,
    gcp_token_uri: process.env.gcp_token_uri,
    gcp_auth_provider_x509_cert_url: process.env.gcp_auth_provider_x509_cert_url,
    gcp_client_x509_cert_url: process.env.gcp_client_x509_cert_url,
    gcp_universe_domain: process.env.gcp_universe_domain,

    
    // Azure Blob Storage
    azureStorageAccount: process.env.AZURE_STORAGE_ACCOUNT,
    azureStorageContainerName: process.env.AZURE_STORAGE_CONTAINER_NAME,
    azureStorageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
    azureStorageSASToken: process.env.AZURE_STORAGE_SAS_TOKEN,
};