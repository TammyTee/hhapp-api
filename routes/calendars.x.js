const express = require('express');
const q = require('q');
const oauth = require('oauth');
const gcal = require('google-calendar');

const router = express.Router();


let oa;
let refreshToken;

let clientId = process.env.GOOGLE_CLIENT_ID;
let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
let googleUserId = process.env.GOOGLE_USER_EMAIL;
let baseUrl = process.env.CAL_API_URL;

let scopes = 'https://www.googleapis.com/auth/calendar';

// const API_KEY = 'AIzaSyCQeOeX1q_PDPJZypB2K3wR-hl0Slt2Se0';

// Essential Steps for Creating Booking App
//
// - Authorize Google with OAuth2 and retrieve access token
// - store access token in local storage (look into serializing)
//
// - write a function to be used for retrieving access token from ls
// - maybe this could just be a matter of setting ls.accessToken to var

// ROUTES
// - GET /events : retrieve all events from calendar
// - POST /events: add new calendar event, return new event to update UI

router.get('/authorize', function (req, res) {
  console.log(clientId, clientSecret);
  oa = new oauth.OAuth2(clientId,
    clientSecret,
    "https://accounts.google.com/o",
    "/oauth2/auth",
    "/oauth2/token");

  res.redirect(
    oa.getAuthorizeUrl(
      {
        scope         : scopes,
        response_type : 'code',
        redirect_uri  : baseUrl + '/callback',
        access_type   : 'offline', // gets refresh token
        user_id       : googleUserId
      }
    )
  );

  // res.send('ok');
});

router.get('/callback', function(req, res){
  console.log(req.query);

  if(req.query.code){
    oa.getOAuthAccessToken(req.query.code,
        {
          grant_type    : 'authorization_code',
          redirect_uri  : baseUrl + '/callback'
        },
        function(err, access_token, refresh_token, response){

          if(err)
          {
            res.end('error: ' + JSON.stringify(err));
          }
          else
          {

            console.log('received access token');
            console.log('Access Token ',  access_token);

            if(refresh_token !== undefined){
              console.log('Refresh Token ', refresh_token);
            }

            res.send('ok');

            // //lookup settings from database
            // connect().then(function(){
            //   database.collection(mongoCollectionName).findOne({google_user_id: googleUserId}, function(findError, settings){
            //     console.log('--writing access token to database--');
            //     var accessTokenExpiration = new Date().getTime() + (3500 * 1000);
            //
            //     //update access token in database
            //     settings.google_access_token = access_token;
            //     settings.google_access_token_expiration = accessTokenExpiration;
            //
            //     //set google refresh token if it is returned
            //     if(refresh_token != undefined) settings.google_refresh_token = refresh_token;
            //
            //     database.collection(mongoCollectionName).save(settings);
            //
            //     response.writeHead(200, {"Content-Type": "application/javascript"});
            //     response.write('refresh token: ' + refresh_token + '\n');
            //     response.write(JSON.stringify(res, null, '\t'));
            //     response.end();
            //   });
            // });

          }
        });
  }
});

const authorize = () => {
  let deferred = q.defer();

  oa = new oauth.OAuth2(clientId, clientSecret, 'https://accounts.google.com/o', '/oauth2/auth', '/oauth2/token');

  if(refreshToken){
    oa.getOAuthAccessToken(
        refreshToken,
        {
          grant_type:'refresh_token',
          client_id: clientId,
          client_secret: clientSecret
        },
        function(err, access_token, refresh_token, res){

          if(err)
            return console.log(err);

          console.log('Access Token: ', access_token, '\n Refresh Token: ', refresh_token, '\n Response: ', res)

      //   //lookup settings from database
      //   connect().then(function(){
      //     database.collection(mongoCollectionName).findOne({google_user_id: googleUserId}, function(findError, settings){
      //
      //       let expiresIn = parseInt(res.expires_in);
      //       let accessTokenExpiration = new Date().getTime() + (expiresIn * 1000);
      //
      //       //add refresh token if it is returned
      //       if(refresh_token !== undefined) settings.google_refresh_token = refresh_token;
      //
      //       //update access token in database
      //       settings.google_access_token = access_token;
      //       settings.google_access_token_expiration = accessTokenExpiration;
      //
      //       database.collection(mongoCollectionName).save(settings);
      //
      //       deferred.resolve(access_token);
      //     });
      //   });
      })
  } else {
    deferred.reject({error: 'Application needs authorization.'});
  }

  return deferred.promise;

};

module.exports = router;