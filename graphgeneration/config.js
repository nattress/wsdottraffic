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
    AZURE_ACCOUNT_NAME: "nattress",

    AZURE_ACCESS_KEY: "gflE974jFfd2yk/9KSTdcjOfIuSEcw7KNTShiOC1FVkroQPE+dSNHZO6KM6PXKJuVq7yiuW9meNhfZaJ3knsAA==",

    AZURE_BLOB_STORAGE: "http://nattress.blob.core.windows.net",
};

module.exports = Constants;