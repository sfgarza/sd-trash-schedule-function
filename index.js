/**
 * Google Cloud Function that uses puppeteer to retrieve the Trash/Recycling Schedule 
 * from a form on the San Diego County website
 */
const puppeteer = require('puppeteer');
const API_KEY =  process.env.API_KEY;

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.trashSchedule = async (req, res) => {
  const streetnum = req.query.streetnumber || req.body.streetnumber || false;
  const streetname = req.query.streetname || req.body.streetname || false ;
  const streetsuffix = req.query.streetsuffix || req.body.streetsuffix || false;
  const apikey = req.query.apikey || req.body.apikey;
  const message = {};
  let status = 200;
  
  // Check if usage is allowed.
  // TODO: Add usage tracking.
  if( apikey !== API_KEY ){
    status = 403;
    message.err = 'Could not validate credentials';
  }
  // Check for required fields.
  else if( streetnum == false || streetname == false ){
    status = 400;
    message.err = 'Required field missing';

  // If all checks pass, check the trash schedule.
  }else{
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
      // slowMo: 30 // slow down by 250ms
    });
    const page = await browser.newPage();
    
    try{
      
      // This is Salesforce JS form, so its not possible to form a static GET query.
      await page.goto('https://getitdone.force.com/ESD_TrashCollectionSchedule');
      
      // Type into search box.
      await page.type('.form-item-streetnumber > input', streetnum);
      await page.type('.form-item-streetname > input', streetname);
      if( streetsuffix !== false ){
        await page.type('.form-item-streetSuffix > input', streetsuffix);
      }
      
      // Wait for suggest overlay to appear and click "show all results".
      const allResultsSelector = 'button#SearchSiteBtn.search.btn.ReportButton';
      //await page.waitForSelector(allResultsSelector);
      await page.click(allResultsSelector);
      
      // Wait for the results page to load and display the results.
      var resultsSelector = "//strong[contains(text(), 'Select')]";
      
      // Click on result link
      await page.waitForXPath(resultsSelector);
      const linkHandlers = await page.$x(resultsSelector);    
      if (linkHandlers.length > 0) {
        await linkHandlers[0].click();
        await  page.waitFor(300);
      } else {
        throw new Error("Link not found");
      }
      
      // Click Next button.
      resultsSelector = "//a[contains(text(), 'Next')]";
      await page.waitForXPath(resultsSelector);
      const linkHandlers2 = await page.$x(resultsSelector);
      if (linkHandlers2.length > 0) {
        await Promise.all([
          linkHandlers2[0].click(),
          page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
      } else {
        throw new Error("Link not found");
      }
      await  page.waitFor(300);
      
      // Extract the results from the table on the page.
      const data = await page.evaluate(() => {
        const tds = Array.from(document.querySelectorAll('table td'))
        return tds.map(td => td.innerText);
        for (var i = 0; i < array.length; i++) {
          array[i]
        }
      });
      
      // Set JSON resukt
      message.trash   = data[3];
      message.recycle = data[7];
      
    }catch(err){
      console.error(err);
      message.err = 'Could not retrieve trash pickup schedule';
      status = 400;
    }
    
    // Close session.
    await browser.close();
  }
  
  // Send results.
  res.status(status).json(message);
};
