/*******************************************************
 * MODULES                                             *
 ******************************************************/
const express = require('express');
const google  = require('googleapis');
const gcal    = require('google-calendar');
const q       = require('q');
const mongo   = require('mongodb').MongoClient;
const router = express.Router();

/*******************************************************
 * VARIABLES                                           *
 ******************************************************/

// OAuth2 Settings
const OAuth2Client  = google.auth.OAuth2;

const CLIENT_ID      = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET  = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URL   = process.env.CAL_API_URL + '/callback';
const GOOGLE_USER_ID = process.env.GOOGLE_USER_EMAIL;
const EVENT_CALENDAR = process.env.GOOGLE_EVENT_CAL_ID;

// OAuth2
let oauth2client; // = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
let refreshToken;

// Database
let collection = 'users';
let uri        = process.env.MONGO_DB_URI;
let database;

/*******************************************************
 *  ROUTES FOR AUTHORIZING HOOKAH HILL TO ACCESS G CAL *
 ******************************************************/

router.get('/', function(req ,res){
  res.send('<!DOCTYPE html><meta charset=utf-8><form action=/api/gcal/authorize><input type=submit>');
});

router.get('/authorize', function (req, res) {
  oauth2client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

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
        // console.log(tokens);
        res.end('error: ' + JSON.stringify(err));
      }
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      if (!err) {
        // connect to db and save tokens
        connect().then(function(){
          database.collection(collection).findOne({google_user_id: GOOGLE_USER_ID}, function(findError, settings){
            console.log('--writing access token to database--');

            if(findError) console.log(findError);

            settings.access_token = tokens.access_token;
            settings.expiry_date  = tokens.expiry_date;

            // if a refresh_token is returned set it and save to db
            if(tokens.refresh_token) refreshToken = tokens.refresh_token;
            if(refreshToken !== undefined) settings.refresh_token = refreshToken;

            // save updated settings for doc
            database.collection(collection).save(settings);

            oauth2client.setCredentials({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expiry_date : tokens.expiry_date
            });

            res.write('refresh token: ' + refreshToken + '\n');
            res.end();

            // console.log(settings); // this is just the doc off the corresponding GOOGLE_USER_ID
          });
        });

        // console.log(tokens);
        // localStorage.setItem('access_token', tokens.access_token);
        // localStorage.setItem('refresh_token', tokens.refresh_token);
        // res.send('Tokens saved');
      }
    });
  }
});

/*******************************************************
 *  ROUTES FOR G CAL EVENTS                            *
 ******************************************************/

router.get('/events', function (req, res) {

  let getGoogleEvents = function(access_token) {

    let google_calendar = new gcal.GoogleCalendar(access_token);
    google_calendar.events.list(EVENT_CALENDAR, function(err, eventList){
      if(err) {
        res.status(500).send(err);
      }else{
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify(eventList, null, '\t'));
        res.end();
      }

    });
  };

  //retrieve current access token
  getAccessToken().then(function(accessToken){
    getGoogleEvents(accessToken);
  }, function(error){
    //TODO: handle getAccessToken error
  });

});


/*******************************************************
 *  METHODS                                            *
 ******************************************************/
function connect(callback)
{
  let deferred = q.defer();

  if(database === undefined)
  {
    mongo.connect(uri, function (err, db) {
      if(err) deferred.reject({error: err});

      database = db;
      deferred.resolve();
    })
  }
  else
  {
    deferred.resolve();
  }

  return deferred.promise;
}

// use to reauthorize if the current access token is expired
function authorize() {
  let deferred = q.defer();
  oauth2client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

  if(refreshToken)
  {
    oauth2client.getOAuthAccessToken(refreshToken, {grant_type:'refresh_token'},
      function(err, access_token, refresh_token, res){

        //lookup settings from database
        connect().then(function(){
          database.collection(collection).findOne({google_user_id: GOOGLE_USER_ID}, function(findError, settings){

            let accessTokenExpiration = (new Date()).getTime() + (1000 * 60 * 60 * 24 * 7);

            //add refresh token if it is returned
            if(refresh_token !== undefined) settings.refresh_token = refresh_token;

            //update access token in database
            settings.access_token = access_token;
            settings.expiry_date = accessTokenExpiration;

            database.collection(collection).save(settings);

            console.log('-- access token updated:', access_token);

            deferred.resolve(access_token);
          });
        });
      })
  }
  else
  {
    deferred.reject({error: 'Application needs authorization.'});
  }

  return deferred.promise;
}

// retrieve current access_tokenlet
function getAccessToken() {
  let deferred = q.defer();
  let accessToken;

  connect().then(function(){

    database.collection(collection).findOne({google_user_id: GOOGLE_USER_ID}, function(findError, settings){
      console.log('GOOGLE SETTINGS RESPONSE:', settings, findError);

      //check if access token is still valid
      let today = new Date();
      let currentTime = today.getMilliseconds();
      // let currentTime = today.getTime();

      if(currentTime < settings.expiry_date)
      {
        //use the current access token
        accessToken = settings.access_token;
        deferred.resolve(accessToken)
      }
      else
      {
        //refresh the access token
        console.log('-- refreshing access token --');
        authorize().then(function(token){

          accessToken = token;
          deferred.resolve(accessToken);

        }, function(error){

          deferred.reject(error);

        });
      }
    });

  }, function(error){
    deferred.reject(error);
  });

  return deferred.promise;
}

module.exports = router;