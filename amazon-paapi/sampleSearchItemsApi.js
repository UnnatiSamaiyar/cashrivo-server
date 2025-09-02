var ProductAdvertisingAPIv1 = require('./src/index');
var defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
defaultClient.host = process.env.AMAZON_HOST;
defaultClient.region = process.env.AMAZON_REGION;
defaultClient.host = process.env.AMAZON_HOST;
defaultClient.region = process.env.AMAZON_REGION;
var api = new ProductAdvertisingAPIv1.DefaultApi();
var searchItemsRequest = new ProductAdvertisingAPIv1.SearchItemsRequest();
getItemsRequest['PartnerTag'] = process.env.AMAZON_PARTNER_TAG;
getItemsRequest['PartnerType'] = 'Associates';
searchItemsRequest['Keywords'] = 'Harry Potter';
searchItemsRequest['SearchIndex'] = 'Books';
searchItemsRequest['ItemCount'] = 2;
searchItemsRequest['Resources'] = ['Images.Primary.Medium', 'ItemInfo.Title', 'Offers.Listings.Price'];
function onSuccess(data) {
  console.log('API called successfully.');
  var searchItemsResponse = ProductAdvertisingAPIv1.SearchItemsResponse.constructFromObject(data);
  console.log('Complete Response: \n' + JSON.stringify(searchItemsResponse, null, 1));
  if (searchItemsResponse['SearchResult'] !== undefined) {
    console.log('Printing First Item Information in SearchResult:');
    var item_0 = searchItemsResponse['SearchResult']['Items'][0];
    if (item_0 !== undefined) {
      if (item_0['ASIN'] !== undefined) {
        console.log('ASIN: ' + item_0['ASIN']);
      }
      if (item_0['DetailPageURL'] !== undefined) {
        console.log('DetailPageURL: ' + item_0['DetailPageURL']);
      }
      if (
        item_0['ItemInfo'] !== undefined &&
        item_0['ItemInfo']['Title'] !== undefined &&
        item_0['ItemInfo']['Title']['DisplayValue'] !== undefined
      ) {
        console.log('Title: ' + item_0['ItemInfo']['Title']['DisplayValue']);
      }
      if (
        item_0['Offers'] !== undefined &&
        item_0['Offers']['Listings'] !== undefined &&
        item_0['Offers']['Listings'][0]['Price'] !== undefined &&
        item_0['Offers']['Listings'][0]['Price']['DisplayAmount'] !== undefined
      ) {
        console.log('Buying Price: ' + item_0['Offers']['Listings'][0]['Price']['DisplayAmount']);
      }
    }
  }
  if (searchItemsResponse['Errors'] !== undefined) {
    console.log('Errors:');
    console.log('Complete Error Response: ' + JSON.stringify(searchItemsResponse['Errors'], null, 1));
    console.log('Printing 1st Error:');
    var error_0 = searchItemsResponse['Errors'][0];
    console.log('Error Code: ' + error_0['Code']);
    console.log('Error Message: ' + error_0['Message']);
  }
}

function onError(error) {
  console.log('Error calling PA-API 5.0!');
  console.log('Printing Full Error Object:\n' + JSON.stringify(error, null, 1));
  console.log('Status Code: ' + error['status']);
  if (error['response'] !== undefined && error['response']['text'] !== undefined) {
    console.log('Error Object: ' + JSON.stringify(error['response']['text'], null, 1));
  }
}

api.searchItems(searchItemsRequest).then(
  function(data) {
    onSuccess(data);
  },
  function(error) {
    onError(error);
  }
);
