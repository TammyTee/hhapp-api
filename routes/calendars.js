const express = require('express');
const google  = require('googleapis');
const gcal = require('google-calendar');
const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./scratch');


const OAuth2Client  = google.auth.OAuth2;
const calendar = google.calendar('v3');

const router = express.Router();

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL  = process.env.CAL_API_URL + '/callback';
const GOOGLE_USER_ID = process.env.GOOGLE_USER_EMAIL;


let oauth2client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

google.options({
  auth: oauth2client
});

router.get('/authorize', function (req, res) {
  let url = oauth2client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    scope: 'https://www.googleapis.com/auth/calendar', // can be a space-delimited string or an array of scopes
    user_id: GOOGLE_USER_ID
  });

  res.redirect(url);
});

router.get('/callback', function (req, res) {
  if(req.query.code) {
    oauth2client.getToken(req.query.code, function (err, tokens) {
      if(err){
        console.log(tokens);
        res.send(err.code);
      }
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      if (!err) {
        console.log(tokens);
        localStorage.setItem('access_token', tokens.access_token);

        oauth2client.setCredentials({
          access_token: tokens.access_token,
          expiry_date : tokens.expiry_date
        });
        res.send('ok');
      }
    });
  }
});

router.get('/events', function (req, res) {

  let getGoogleEvents = function(accessToken)
  {
    //instantiate google calendar instance
    let google_calendar = new gcal.GoogleCalendar(accessToken);

    google_calendar.events.list('h386pnm977hknar8soh1ppojl0@group.calendar.google.com', function(err, eventList){
      if(err){
        res.send(500, err);
      }
      else{
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify(eventList, null, '\t'));
        res.end();
      }
    });
  };

  let access_token = localStorage.getItem('access_token');
  getGoogleEvents(access_token);

});



module.exports = router;