var logglyModule = require('loggly');
var azure = require('azure-storage');
var config = require('./config');
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

// Boot-strap the periodic timer so that we wake up and auto-save games, remove un-used games from
// memory, disconnect inactive users, etc
//setTimeout(collectData, config.PERIODIC_TIMER_INTERVAL);
var trafficTable = "traffictable";

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
            setupComplete();
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
    setTimeout(collectData, config.PERIODIC_TIMER_INTERVAL);
}

// A quick workaround for a callback function in a loop not capturing the values of
// variables as they were for a particular iteration of the loop. They get passed
// in to this function so their values are preserved on the stack.
function insertEntity(entity, travelTimeId, timeUpdated)
{
    storageClient.insertEntity(trafficTable, entity, function(error, result, response) {
        if (error != undefined && error.code != undefined && error.code == "EntityAlreadyExists")
        {
            loggly.log("Data already logged for TravelTimeID " + travelTimeId + " at " + timeUpdated);
        }
        else if (error)
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
            loggly.log("Writing " + json.length + " entries");
            
            for (var i = 0; i < json.length; i++)
            {
                var timeUpdated = new Date(parseInt(json[i].TimeUpdated.substr(6)));

                var dataPoint = {
                    PartitionKey: entGen.String("rawtraffic"),
                    RowKey: entGen.String(json[i].TravelTimeID + "_" + timeUpdated),
                    TimeUpdated: entGen.DateTime(timeUpdated),
                    TravelTimeID: entGen.String(json[i].TravelTimeID),
                    AverageTime: entGen.String(json[i].AverageTime),
                    CurrentTime: entGen.String(json[i].CurrentTime),
                    Name: entGen.String(json[i].Name)
                };

                insertEntity(dataPoint, json[i].TravelTimeID, timeUpdated);
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

setupServer();

// <3