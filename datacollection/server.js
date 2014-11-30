var logglyModule = require('loggly');
var azure = require('azure-storage');
var config = require('./config');
var plotly = require('plotly')(config.PLOTLY_USERNAME, config.PLOTLY_API_KEY);
var RestClient = require('node-rest-client').Client;
var restClient = new RestClient();
var plotlyLayout = require('./plotlylayout');

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
var blobClient = azure.createBlobService(config.AZURE_ACCOUNT_NAME, config.AZURE_ACCESS_KEY);

loggly.log("Wsdot Travel Time Monitor");

var trafficTable = "traffictable";
var travelTimeIDToPlotlyUrlTable = "travelTimeIDToPlotlyUrlTable";
var graphPreviewContainer = "graphpreviewcontainer";
var travelTimeIDToNameMap = {};

// Kick off table creation on Azure
function setupServer()
{
    storageClient.createTableIfNotExists(trafficTable, 
        function tableCreated(err, created, response)
        {
            if(err)
                throw err;

            if (created)
                loggly.log(trafficTable + " table created since it was not found.");
            else
                loggly.log(trafficTable + " table already exists.");

            storageClient.createTableIfNotExists(travelTimeIDToPlotlyUrlTable, 
                function tableCreated(err, created, response)
                {
                    if (err)
                        throw err;

                    if (created)
                        loggly.log(travelTimeIDToPlotlyUrlTable + " table created since it was not found.");
                    else
                        loggly.log(travelTimeIDToPlotlyUrlTable + " table already exists.");

                    blobClient.createContainerIfNotExists(graphPreviewContainer, {publicAccessLevel : 'blob'},
                        function(error, result, response)
                        {
                            if (error)
                                throw error;

                            setupComplete();
                        }
                    );
                }
            );
        }
    );
}

function setupComplete()
{
    loggly.log("Server ready. Starting periodic data collection");
    collectData();
}

function waitForData()
{
    loggly.log("Waiting " + config.PERIODIC_TIMER_INTERVAL + "ms until another data collection");
    setTimeout(collectData, config.PERIODIC_TIMER_INTERVAL);
}

// Call after the first set of data from the WSDOT API is received, which populates our travelTimeID => name map
// and is used in graph titles
var graphGenerationStarted = false;
function beginGraphGeneration()
{
    if (!graphGenerationStarted)
    {
        graphGenerationStarted = true;
        generatePlotlyGraphs();
    }
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
function insertEntity(tableName, entity, replace)
{
    if (replace != undefined && replace)
    {
        storageClient.insertOrReplaceEntity(tableName, entity, function(error, result, response) {
            if (error && error.code != "EntityAlreadyExists")
            {
                loggly.log(error);
            }
        });
    }
    else
    {
        storageClient.insertEntity(tableName, entity, function(error, result, response) {
            if (error && error.code != "EntityAlreadyExists")
            {
                loggly.log(error);
            }
        });
    }
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

                travelTimeIDToNameMap[json[i].TravelTimeID] = json[i].Name;
                insertEntity(trafficTable, dataPoint);
            }

            beginGraphGeneration();
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
    generateNextPlotlyGraph(config.PLOTLY_TRAVEL_TIME_IDS.slice(0));
    waitForGraphGeneration();
}

function generateNextPlotlyGraph(travelTimeIDs)
{
    var travelTimeID = travelTimeIDs.splice(0, 1)[0];

    generatePlotlyGraph(travelTimeID, function()
    {
        if (travelTimeIDs.length > 0)
        {
            generateNextPlotlyGraph(travelTimeIDs);
        }
    });
}

function generatePlotlyGraph(travelTimeID, doneCallback)
{
    loggly.log("Generating plotly graph for route " + travelTimeID);

    var query = new azure.TableQuery()
        .where('PartitionKey eq ?', travelTimeID.toString());

    getAllDataForTravelTimeID(travelTimeID, query, null, [{x: [], y: [], type: "scatter" }], function(travelTimeID, data)
    {
        var layoutInfo = plotlyLayout.getPlotlyLayout(travelTimeIDToNameMap[travelTimeID]);
        var graph_options = {
            filename: "traveltimes-" + travelTimeID, 
            fileopt: "overwrite",
            layout: layoutInfo
        };
        
        plotly.plot(data, graph_options, function (err, msg) {
            if (err)
            {
                loggly.log("Error submitting data to plotly: " + err);
                loggly.log("Error submitting data to plotly: " + msg);
            }
            else
            {
                loggly.log("Successfully wrote new graph to plotly for travelTimeID: " + travelTimeID + " (" + msg.url + ")");
                //
                // Hack: We need the graph ID to feed to getFigure but the only place I can find it in
                // the results is by parsing off the end of msg.url, assuming the id is always going
                // to be last in the URL after a foward slash. This is brittle and hopefully I can dig 
                // up a better way of finding it in the API.
                //
                var re = /\/[0-9]+$/i;
                var found = msg.url.match(re);
                if (!found)
                {
                    loggly.log("Error parsing graph identifier from URL " + msg.url);
                    return;
                }
                
                plotly.getFigure(config.PLOTLY_USERNAME, found[0].substr(1), function(err, figure)
                {
                    if (err)
                    {
                        loggly.log("Error getting graph from plotly: " + err);
                    }
                    else
                    {
                        var payload = {
                            'figure': figure,
                            'format': 'png'
                        }

                        plotly.saveImage(payload, "graph", function(err)
                        {
                            if (err)
                            {
                                loggly.log("Error saving graph to disk: " + err);
                            }
                            else
                            {
                                loggly.log("Graph saved");
                                blobClient.createBlockBlobFromLocalFile (graphPreviewContainer, travelTimeID.toString(), "graph.png", function(error, result, response)
                                {
                                    if (error)
                                    {
                                        loggly.log("Error creating blob from file");
                                        loggly.log(error);
                                    }
                                    else
                                    {
                                        var idToUrlEntity = {
                                            PartitionKey: entGen.String("none"),
                                            RowKey: entGen.String(travelTimeID.toString()),
                                            url: entGen.String(msg.url),
                                            previewImage: entGen.String(config.AZURE_BLOB_STORAGE + "/graphpreviewcontainer/" + travelTimeID),
                                            name: entGen.String(travelTimeIDToNameMap[travelTimeID])
                                        };
                                        insertEntity(travelTimeIDToPlotlyUrlTable, idToUrlEntity, true);

                                        doneCallback();
                                    }
                                });
                            }
                        });
                    }
                });
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