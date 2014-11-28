var express = require('express');
var router = express.Router();
var config = require('../config');
var plotly = require('plotly')(config.PLOTLY_USERNAME,config.PLOTLY_API_KEY);

/* GET users listing. */
router.get('/', function(req, res) {
    res.send('respond with a resource');


    var data = [
      {
        x: ["2013-10-04 22:23:00", "2013-11-04 22:23:00", "2013-12-04 22:23:00"], 
        y: [1, 3, 6], 
        type: "scatter"
      }
    ];
    var graph_options = {filename: "date-axes", fileopt: "overwrite"}
    plotly.plot(data, graph_options, function (err, msg) {
        console.log(msg);
    });
});

module.exports = router;
