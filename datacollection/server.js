var logglyModule = require('loggly');
var azure = require('azure-storage');
var config = require('./config');
var plotly = require('plotly')(config.PLOTLY_USERNAME, config.PLOTLY_API_KEY);
var RestClient = require('node-rest-client').Client;
var restClient = new RestClient();

// Azure storage now expects OData and provides a handy entity generator
var entGen = azure.TableUtilities.entityGenerator;

if (config.LOGGLY_TOKEN == "ENTER_YOUR_LOGGLY_TOKEN" || config.LOGGLY_SUBDOMAIN == "ENTER_YOUR_LOGGLY_DOMAIN")
{
    var loggly = console;
}
else
{
    var loggly = logglyModule.createClient({
        token: config.LOGGLY_TOKEN,
        subdomain: config.LOGGLY_SUBDOMAIN,
        tags: ["NodeJS"],
        json:true
    });
}

//
// Use local Azure storage emulator table service
// Remember to set EMULATED=1 in the node.js environment window
//
//var storageClient = azure.createTableService();
var storageClient = azure.createTableService(config.AZURE_ACCOUNT_NAME, config.AZURE_ACCESS_KEY);

loggly.log("Wsdot Travel Time Monitor");

var trafficTable = "traffictable";
var travelTimeIDToPlotlyUrlTable = "travelTimeIDToPlotlyUrlTable";

// Kick off table creation on Azure
function setupServer()
{
    storageClient.createTableIfNotExists(trafficTable, 
        function tableCreated(err, created, response)
        {
            if(err)
                throw err;

            if (created)
                loggly.log("Table created since it was not found.");
            else
                loggly.log("Table already exists.");

            storageClient.createTableIfNotExists(travelTimeIDToPlotlyUrlTable, 
                function tableCreated(err, created, response)
                {
                    if (err)
                        throw err;

                    if (created)
                        loggly.log("Table created since it was not found.");
                    else
                        loggly.log("Table already exists.");

                    setupComplete();
                }
            );
        }
    );
}

function setupComplete()
{
    loggly.log("Server ready. Starting periodic data collection");
    collectData();
    generatePlotlyGraphs();
}

function waitForData()
{
    loggly.log("Waiting " + config.PERIODIC_TIMER_INTERVAL + "ms until another data collection");
    setTimeout(collectData, config.PERIODIC_TIMER_INTERVAL);
}

function waitForGraphGeneration()
{
    loggly.log("Waiting " + config.PLOTLY_TIMER_INTERVAL + "ms until another graph generation");
    setTimeout(generatePlotlyGraphs, config.PLOTLY_TIMER_INTERVAL);
}

// http://stackoverflow.com/questions/2998784/how-to-output-integers-with-leading-zeros-in-javascript
function pad(num, size)
{
    var s = "000000000" + num;
    return s.substr(s.length - size);
}

//
// Given a date, returns it in yyyy-mm-dd hh:mm:ss format so that entities will be sorted by
// date and range queries will be efficient
//
function formatDateForLexicographicSearch(date)
{
    return pad(date.getFullYear(), 4) + "-" + pad(date.getMonth() + 1, 2) + "-" + pad(date.getDate(), 2)
            + " " + pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":" + pad(date.getSeconds(), 2);
}

// A quick workaround for a callback function in a loop not capturing the values of
// variables as they were for a particular iteration of the loop. They get passed
// in to this function so their values are preserved on the stack.
function insertEntity(tableName, entity)
{
    storageClient.insertEntity(tableName, entity, function(error, result, response) {
        if (error && error.code != "EntityAlreadyExists")
        {
            loggly.log(error);
        }
    });
}

function collectData()
{
    // Collect Data
    loggly.log("Collecting data");

    var req = restClient.get(config.WSDOT_GET_TRAVEL_TIMES_API + config.WSDOT_ACCESS_CODE, function(data, response)
        {
            var json = JSON.parse(data);
            
            for (var i = 0; i < json.length; i++)
            {
                var timeUpdated = new Date(parseInt(json[i].TimeUpdated.substr(6)));
                var lexDate = formatDateForLexicographicSearch(timeUpdated);
                var dataPoint = {
                    PartitionKey: entGen.String(json[i].TravelTimeID.toString()),
                    RowKey: entGen.String(lexDate),
                    TimeUpdated: entGen.DateTime(timeUpdated),
                    TravelTimeID: entGen.String(json[i].TravelTimeID),
                    AverageTime: entGen.String(json[i].AverageTime),
                    CurrentTime: entGen.String(json[i].CurrentTime),
                    Name: entGen.String(json[i].Name)
                };
                insertEntity(trafficTable, dataPoint);
            }

            waitForData();
        });
    
    req.on("requestTimeout", function(req)
    {
        loggly.log("Request timed out.");
        req.abort();
        waitForData();
    });

    req.on("responseTimeout", function(res)
    {
        loggly.log("Response has expired.");
        waitForData();
    });

    req.on("error", function(error)
    {
        loggly.log("Error in request", error);
        waitForData();
    });
}

//
// Periodic job that builds Plotly graphs for the traffic data of selected routes.
// The config file contains an array, PLOTLY_TRAVEL_TIME_IDS, which specifies the
// WSDOT API's TravelTimeIDs to build graphs for.  There are some routes in the data
// that probably aren't broadly useful, so we'll avoid hammering Plot.ly's servers
//
function generatePlotlyGraphs()
{
    config.PLOTLY_TRAVEL_TIME_IDS.forEach(function(id)
    {
        generatePlotlyGraph(id);
    });

    waitForGraphGeneration();
}

function generatePlotlyGraph(travelTimeID)
{
    loggly.log("Generating plotly graph for route " + travelTimeID);

    var query = new azure.TableQuery()
        .where('PartitionKey eq ?', travelTimeID.toString());

    getAllDataForTravelTimeID(travelTimeID, query, null, [{x: [], y: [], type: "scatter" }], function(travelTimeID, data)
        {
            var graph_options = {filename: "traveltimes-" + travelTimeID, fileopt: "overwrite"}
            
            plotly.plot(data, graph_options, function (err, msg) {
                if (err)
                {
                    loggly.log("Error submitting data to plotly: " + err);
                    loggly.log("Error submitting data to plotly: " + msg);
                }
                else
                {
                    loggly.log("Successfully wrote new graph to plotly for travelTimeID: " + travelTimeID + " (" + msg.url + ")");
                    //msg.url
                    var idToUrlEntity = {
                        PartitionKey: entGen.String("none"),
                        RowKey: entGen.String(travelTimeID.toString()),
                        url: entGen.String(msg.url)
                    };
                    insertEntity(travelTimeIDToPlotlyUrlTable, idToUrlEntity);
                }
            });
        });
}

function getAllDataForTravelTimeID(travelTimeID, query, continuationToken, data, callback)
{
    storageClient.queryEntities(trafficTable, query, continuationToken, function(error, result, response)
    {
        if (error)
        {
            loggly.log("Error trying to collect data for traveltimeid " + travelTimeID + ": " + error);
        }
        else
        {
            for (var i = 0; i < result.entries.length; i++)
            {
                data[0].x.push(result.entries[i].RowKey._);
                data[0].y.push(result.entries[i].CurrentTime._);
            }
            
            if (result.continuationToken == null)
            {
                callback(travelTimeID, data);
            }
            else
            {
                getAllDataForTravelTimeID(travelTimeID, query, result.continuationToken, data, callback);
            }
        }
    });
}
setupServer();

// <3