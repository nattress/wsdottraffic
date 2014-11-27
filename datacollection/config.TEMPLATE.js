//
// This config file must be renamed to config.js before deployment.
// Further, the values in the for the AZURE_, WSDOT_, and LOGGLY_, 
// constants must be filled in to point at your specific details.
// See each section for more information on how to get the correct
// values.
//



exports = module.exports;

var Constants = {
    
    //
    // REQUIRED values.  You *must* provide your own Azure Storage credentials,
    // as well as a WSDOT access code
    //

    //
    // Azure Table Storage
    //
    // You will need an existing Azure Storage account and access key.
    // You can grab these off https://manage.windowsazure.com
    // Select your storage account and click on "Manage Access Keys" at the bottom
    // of the page.  There will be fields for storage account name, primary access key, 
    // and secondary access key.
    //
    AZURE_ACCOUNT_NAME: "ENTER_YOUR_ACCOUNT_NAME",

    AZURE_ACCESS_KEY: "ENTER_YOUR_ACCESS_KEY",

    //
    // ACCESS_CODE must be set to the one assigned to you by WSDOT.
    // See: http://www.wsdot.wa.gov/traffic/api/
    //
    WSDOT_ACCESS_CODE: "ENTER_YOUR_ACCESS_CODE",
    
    //
    // OPTIONAL values. You *may* provide a Loggly account. If you don't, we'll just
    // use the command line
    //


    //
    // Loggly
    //
    // Send logging information to the Loggly cloud logging service.
    // If the LOGGLY_ variables are left as defaults, the default command line logger will be used
    // See: https://www.loggly.com
    //
    LOGGLY_TOKEN: "ENTER_YOUR_LOGGLY_TOKEN",

    LOGGLY_SUBDOMAIN: "ENTER_YOUR_LOGGLY_DOMAIN",

    //
    // Internal config - do not alter these values unless you want to break things :)
    //
    
    //
    // The API to call to get travel times for the Seattle area
    //
    WSDOT_GET_TRAVEL_TIMES_API: "http://www.wsdot.wa.gov/Traffic/api/TravelTimes/TravelTimesREST.svc/GetTravelTimesAsJson?AccessCode=",

    //
    // Interval in milliseconds to call the API. Wsdot states that the API refreshes every 90 seconds
    //
    PERIODIC_TIMER_INTERVAL: 60000,
};

module.exports = Constants;