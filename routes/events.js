const express = require('express');
const request = require('request');
const router = express.Router();

const token = process.env.EVENTBRITE_TOKEN;
const api_url = process.env.EVENTBRITE_API_PATH;


// GET events
//noinspection JSUnusedLocalSymbols
router.get('/', function(req, res, next) {
  // Eventbrite API
  // events return as object -- pagination & events

  request(api_url + '?token='+ token, function (error, response,  body) {
    if(error)
      return console.log(error);

    res.send(body);
  });


  // let arr = [1, 2, 3, 4];
});

module.exports = router;
