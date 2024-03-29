const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
puppeteer.use(pluginStealth());
const chrome_path = process.env["chrome_path"];
const args = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-infobars",
  "--window-position=0,0",
  "--ignore-certificate-errors",
  "--ignore-certificate-errors-spki-list",
  "--disable-extensions",
  // "--proxy-server=168.235.93.240:21724",
  "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36"
];

module.exports = puppeteer
  .launch({
    ignoreHTTPSErrors: true,
    userDataDir: "./tmp1",
    executablePath: chrome_path,
    headless: true,
    defaultViewport: null,
    args: args
  })
  .then(async browser => {
    const page = await browser.newPage();
    return { browser, page };
  });
