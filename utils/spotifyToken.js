const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

let tokenCache = null;
let pendingTokenRequest = null;

async function getSpotifyToken() {
  
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.accessToken;
  }

  
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = _fetchSpotifyToken();
  try {
    const token = await pendingTokenRequest;
    return token;
  } finally {
    pendingTokenRequest = null;
  }
}

function _fetchSpotifyToken() {
  return new Promise((resolve, reject) => {

    if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
      return resolve(tokenCache.accessToken);
    }


    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      return reject(new Error('Missing Spotify credentials in environment variables'));
    }

    const postData = querystring.stringify({
      grant_type: 'client_credentials'
    });

    const auth = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const options = {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000, 
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);


          if (json.error) {
            return reject(new Error(`Spotify API Error: ${json.error_description || json.error}`));
          }


          if (!json.access_token || !json.expires_in) {
            return reject(new Error('Invalid response from Spotify API'));
          }


          tokenCache = {
            accessToken: json.access_token,
            expiresAt: Date.now() + (json.expires_in * 1000) - 60000,
          };

          console.log('✅ Spotify token refreshed successfully');
          resolve(json.access_token);

        } catch (error) {
          reject(new Error(`Failed to parse Spotify API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function spotifyApiRequest(endpoint, options = {}) {
  const method = options.method || 'GET';
  const isGet = method.toUpperCase() === 'GET';

  if (isGet) {
    const cacheManager = require('./cacheManager');
    const cached = cacheManager.get('spotifyApi', endpoint);
    if (cached) {
      return cached;
    }
  }

  const token = await getSpotifyToken();
  const { fetchWithRetry } = require('./apiHelper');

  const url = `https://api.spotify.com/v1${endpoint}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      {
        maxRetries: 3,
        timeout: 10000,
        retryDelay: 2000,
        exponentialBackoff: true,
        retryableErrors: [429, 500, 502, 503, 504]
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Spotify API Rate Limit: Retry after ${retryAfter} seconds`);
      }

      let errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Spotify API Error: ${errorJson.error?.message || response.statusText}`);
      } catch {
        throw new Error(`Spotify API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }

    const json = await response.json();
    if (isGet) {
      const cacheManager = require('./cacheManager');
      cacheManager.set('spotifyApi', endpoint, json, 5 * 60 * 1000); 
    }
    return json;
  } catch (error) {
    
    if (error.message.includes('Rate Limit') && error.message.includes('Retry after')) {
      throw error;
    }
    
    throw error;
  }
}

function clearTokenCache() {
  tokenCache = null;
  console.log('🔄 Spotify token cache cleared');
}

module.exports = {
  getSpotifyToken,
  spotifyApiRequest,
  clearTokenCache
};
