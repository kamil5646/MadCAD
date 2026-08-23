const { notarize } = require('@electron/notarize');

exports.default = async function notarizeMac(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;
  const requireNotarization = process.env.MADCAD_REQUIRE_NOTARIZATION === '1';
  const passwordCredentials = [appleId, applePassword, appleTeamId];
  const apiCredentials = [appleApiKey, appleApiKeyId];
  const hasPasswordCredentials = passwordCredentials.some(Boolean);
  const hasApiCredentials = apiCredentials.some(Boolean) || Boolean(appleApiIssuer);

  if (hasPasswordCredentials && !passwordCredentials.every(Boolean)) {
    throw new Error('[notarize] Niepełne dane Apple ID: wymagane są APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD i APPLE_TEAM_ID.');
  }

  if (hasApiCredentials && !apiCredentials.every(Boolean)) {
    throw new Error('[notarize] Niepełne dane API: wymagane są APPLE_API_KEY i APPLE_API_KEY_ID.');
  }

  if (!hasPasswordCredentials && !hasApiCredentials) {
    if (requireNotarization) {
      throw new Error('[notarize] Wydanie wymaga danych Apple do obowiązkowej notaryzacji.');
    }
    console.warn(
      '[notarize] Pomijam notaryzację: nie skonfigurowano danych Apple.'
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const authorization = hasApiCredentials
    ? {
        appleApiKey,
        appleApiKeyId,
        ...(appleApiIssuer ? { appleApiIssuer } : {}),
      }
    : {
        appleId,
        appleIdPassword: applePassword,
        teamId: appleTeamId,
      };

  await notarize({
    appBundleId: packager.appInfo.id,
    appPath,
    ...authorization,
  });

  console.log(`[notarize] Apple zaakceptowało i ostemplowało ${appName}.app.`);
};
