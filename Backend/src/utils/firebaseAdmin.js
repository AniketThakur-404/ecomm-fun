const admin = require('firebase-admin');

const parseServiceAccountFromJson = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const serviceAccount = {
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: String(parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      const parseError = new Error(
        'FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email, or private_key',
      );
      parseError.code = 'FIREBASE_CONFIG_INVALID';
      throw parseError;
    }

    return serviceAccount;
  } catch (error) {
    if (error?.code === 'FIREBASE_CONFIG_INVALID') {
      throw error;
    }
    const parseError = new Error('FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON');
    parseError.code = 'FIREBASE_CONFIG_INVALID';
    throw parseError;
  }
};

const parseServiceAccountFromFields = () => {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    privateKey,
  };
};

const getServiceAccount = () => {
  const fromJson = parseServiceAccountFromJson();
  if (fromJson) return fromJson;
  return parseServiceAccountFromFields();
};

const initFirebaseApp = () => {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
};

const verifyFirebaseIdToken = async (idToken) => {
  const app = initFirebaseApp();
  if (!app) {
    const configError = new Error('Firebase auth is not configured');
    configError.code = 'FIREBASE_NOT_CONFIGURED';
    throw configError;
  }

  return admin.auth(app).verifyIdToken(idToken, true);
};

module.exports = {
  verifyFirebaseIdToken,
};
