const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

const stateKey = 'spotify_auth_state';

const generateRandomString = length => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Replace with your Vue app's domain
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    next();
});
  
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

//   const scope = 'playlist-modify-public playlist-modify-private';
  const scope = 'playlist-modify-private user-read-private user-read-email';
  const queryParams = querystring.stringify({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;
  
    if (state === null || state !== storedState) {
      res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
      return;
    }
  
    res.clearCookie(stateKey);
  
    try {
      const response = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        params: {
          code: code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          grant_type: 'authorization_code'
        },
        headers: {
          'Authorization': 'Basic ' + (Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
  
      const { access_token, refresh_token } = response.data;
  
      // Set the access_token as a cookie
      res.cookie('access_token', access_token, { httpOnly: true });
  
      // Redirect to a page where you can handle further logic
      res.redirect('/success');
    } catch (error) {
      res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
    }
});

app.get('/refresh_token', function(req, res) {

    var refresh_token = req.query.refresh_token;
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (new Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'))
      },
      form: {
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      },
      json: true
    };
  
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
            refresh_token = body.refresh_token;
        res.send({
          'access_token': access_token,
          'refresh_token': refresh_token
        });
      }
    });
});

app.post('/create-playlist', async (req, res) => {
  const { access_token, user_id, name, description } = req.body;

  try {
    const response = await axios({
      method: 'post',
      url: `https://api.spotify.com/v1/users/${user_id}/playlists`,
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: name,
        description: description,
        public: false // Set to true if you want the playlist to be public
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/add-tracks', async (req, res) => {
  const { access_token, playlist_id, track_uris } = req.body;

  try {
    const response = await axios({
      method: 'post',
      url: `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`,
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      data: {
        uris: track_uris
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/playlist/:playlist_id', async (req, res) => {
    const playlist_id = req.params.playlist_id;
    const access_token = req.cookies.access_token;
  
    try {
      const response = await axios({
        method: 'get',
        url: `https://api.spotify.com/v1/playlists/${playlist_id}`,
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
  
      res.json(response.data);
    } catch (error) {
      res.status(error.response.status || 500).json({ error: error.message });
    }
});

app.get('/success', (req, res) => {

    res.json({ success: 'success' });
});

app.get('/', (req, res) => {

    res.json({ msg: 'home' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
