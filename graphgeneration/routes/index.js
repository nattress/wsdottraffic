var express = require('express');
var router = express.Router();
var azure = require('azure-storage');
var TableQuery = azure.TableQuery;
var optional = require('optional');
var config = optional('../config');

// When running on Azure, we pick up the connection strings from environment strings configured
// in the management portal.
if (!config)
{
    config = {
        AZURE_ACCOUNT_NAME: process.env.AZURE_ACCOUNT_NAME,
        AZURE_ACCESS_KEY: process.env.AZURE_ACCESS_KEY
    }
}

var storageClient = azure.createTableService(config.AZURE_ACCOUNT_NAME, config.AZURE_ACCESS_KEY);
var travelTimeIDToPlotlyUrlTable = "travelTimeIDToPlotlyUrlTable";

function getGraphList(callback)
{
    var tableQuery = new TableQuery();

    storageClient.queryEntities(travelTimeIDToPlotlyUrlTable, tableQuery, null, function(error, result) {
        if(!error) {
            var entities = result.entries;
            var graphs = [];
            for (var i = 0; i < entities.length; ++i)
            {
                var graph = {
                    "name": entities[i].name._,
                    "url": entities[i].url._,
                    "previewImage": entities[i].previewImage._,
                };
                graphs.push(graph);
            }
            callback(null, graphs);
        }
        else
        {
            callback(error);
        }
    });
}

/* GET home page. */
router.get('/', function(req, res) {
    getGraphList(function(error, graphs) {
        if (error)
        {
            console.log("Error getting graphs");
            console.log(error);
        }
        else
        {
            res.render('index', { title: 'WSDOT Travel Time Graphs', graphs: graphs });
        }
    });
});

module.exports = router;
