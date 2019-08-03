const fs = require("fs");

let start_cate = process.argv[2] || 0;
let start_pager = process.argv[3] || 0;
let start_item = process.argv[4] || 0;
const out_file = "iherb_product_reviews.csv";

const header = [
  { id: "brand", title: "brand" },
  { id: "source", title: "source" },
  { id: "category", title: "category" },
  { id: "description", title: "description" },
  { id: "name", title: "name" },
  { id: "sku", title: "sku" },
  { id: "upc", title: "upc" },
  { id: "image", title: "image" },
  { id: "product_stars", title: "product_stars" },
  { id: "reviews_count", title: "reviews_count" },
  { id: "product_url", title: "product_url" },
  { id: "review_url", title: "review_url" },
  { id: "title", title: "title" },
  { id: "posted_date", title: "posted_date" },
  { id: "review_stars", title: "review_stars" },
  { id: "review_text", title: "review_text" },
  { id: "helpful", title: "helpful" }
];
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: out_file,
  header: header,
  append: true
});
header_row = [
  {
    brand: "brand",
    source: "source",
    category: "category",
    description: "description",
    name: "name",
    sku: "sku",
    upc: "upc",
    image: "image",
    product_stars: "product_stars",
    reviews_count: "reviews_count",
    product_url: "product_url",
    review_url: "review_url",
    title: "title",
    posted_date: "posted_date",
    review_stars: "review_stars",
    review_text: "review_text",
    helpful: "helpful"
  }
];
if (!fs.existsSync(out_file))
  csvWriter.writeRecords(header_row).then(() => {
    console.log("...Done header ");
  });

(async () => {
  async function main() {
    const { browser, page } = await require("./page");
    await page_set(page);
    // const wb = await get_workbook(out_file);
    // const page2 = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    const url = "https://www.iherb.com/";
    const cate_urls = await get_category_urls(page, url);
    for (let i = start_cate; i < cate_urls.length; i++) {
      let pager_urls = await get_product_pager(page, cate_urls[i]);
      for (let k = start_pager; k < pager_urls.length; k++) {
        let product_urls = await get_product_list_one_page(page, pager_urls[k]);
        for (let j = start_item; j < product_urls.length; j++) {
          console.log(`cate:${i} pager:${k} item:${j}`);
          await page.waitFor(2000);
          while ((await browser.pages()).length > 7) {
            await page.waitFor(5000);
          }

          grab_product_detail(browser, product_urls[j])
            .then(records => {
              write_product_reviews(records);
            })
            .catch(ex => {
              console.log(ex);
            });

          console.log("==============");
        }
        start_item = 0;
      }
      start_pager = 0;
    }
    start_cate = 0;

    // await browser.close()
  }

  async function page_set(page) {
    await page.setRequestInterception(true);
    page.on("request", interceptedRequest => {
      if (
        interceptedRequest.url().endsWith(".png") ||
        interceptedRequest.url().endsWith(".jpg")
      )
        interceptedRequest.abort();
      else interceptedRequest.continue();
    });
  }

  async function write_product_reviews(records) {
    csvWriter
      .writeRecords(records) // returns a promise
      .then(() => {
        console.log("...Done");
      });
  }

  async function get_category_urls(page, url) {
    await page.goto(url, { timeout: 200000 });
    await change_location(page);
    const urls = await page.evaluate(() => {
      return jQuery(".nav-item-list")
        .children("li")
        .filter((i, li) => !jQuery(li).hasClass("alternate"))
        .map(
          (i, li) =>
            "https:" +
            jQuery(li)
              .children("a")
              .attr("href")
        )
        .get();
    });
    return urls;
  }

  async function get_product_list_one_page(page, url) {
    await page.goto(url, { timeout: 200000 });
    const urls = await page.evaluate(() => {
      return jQuery(".products")
        .children(".product")
        .map((i, product) => {
          return jQuery(product)
            .find(".product-link")
            .attr("href");
        })
        .get();
    });
    return urls;
  }
  async function get_product_pager(page, cate_url) {
    await page.goto(cate_url);
    const total = await page.evaluate(() => {
      return parseInt(
        jQuery(".pagination")
          .children(".pagination-link")
          .last()
          .text()
          .trim()
      );
    });
    const urls = [];
    for (let i of Array.from(Array(total).keys())) {
      let url = `${cate_url}?p=${(i + 1).toString()}`;
      urls.push(url);
    }
    return urls;
  }

  async function grab_product_detail(browser, url) {
    const page = await browser.newPage();
    await page_set(page);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { timeout: 200000 });

    await page.waitForFunction(
      () => {
        return jQuery(".product-description-title")
          .last()
          .find(".rating-count").length;
      },
      { timeout: 90000 }
    );
    const product = await page.evaluate(url => {
      const brand = jQuery("#brand")
        .find("span[itemprop=name]")
        .text()
        .trim();
      const source = "iherb";
      const category = jQuery
        .unique(
          jQuery("#breadCrumbs")
            .find("a:contains('Categories')")
            .map((i, icat) =>
              jQuery(icat)
                .next()
                .text()
                .trim()
            )
        )
        .get()
        .join(",");
      const description = jQuery(".content-frame")
        .find("div[itemprop=description]")
        .text()
        .trim()
        .replace(/\s+/g, " ");
      const name = jQuery("#name")
        .text()
        .trim();
      const sku = jQuery("span[itemprop=sku]")
        .text()
        .trim();
      const upc = jQuery("span[itemprop=gtin12]")
        .text()
        .trim();
      const image = jQuery("#iherb-product-image").attr("src");
      const product_stars = parseFloat(
        jQuery(".product-description-title")
          .last()
          .find(".stars-rating")
          .attr("class")
          .replace(/.*icon-stars_([\d]+).*/, `$1`)
          .replace(/5$/, ".5")
          .replace(/0/, "")
      );
      const reviews_count = parseInt(
        jQuery(".product-description-title")
          .last()
          .find(".rating-count > span")
          .text()
          .trim()
      );
      const product_url = url;
      const review_url = jQuery(".product-description-title")
        .last()
        .find(".rating-count")
        .attr("href");

      return {
        brand,
        source,
        category,
        description,
        name,
        sku,
        upc,
        image,
        product_stars,
        reviews_count,
        product_url,
        review_url
      };
    }, url);

    const reviews = await grab_product_review(page, product["review_url"]);

    for (let i = 0; i < reviews.length; i++) {
      reviews[i] = { ...reviews[i], ...product };
    }
    await page.close();
    return reviews;
  }

  async function grab_product_review(page, url) {
    if (!url) return [];
    await page.goto(url, { timeout: 200000 });
    let reviews = [];
    while (true) {
      let ret = await grab_product_review_one_page(page);
      reviews = reviews.concat(ret);
      if ((await flip_review_pager_action(page)) == true) {
        break;
      }
    }
    return reviews;
  }

  async function grab_product_review_one_page(page) {
    await page.waitForSelector(".reviews-list");
    const ret = await page.evaluate(() => {
      return jQuery(".reviews-list")
        .children(".review-row")
        .map((i, row) => {
          const title = jQuery(row)
            .find(".review-headline")
            .text()
            .trim()
            .replace(/\s+/g, " ");
          const posted_date = jQuery(row)
            .find(".posted-date")
            .text()
            .replace("Posted on", "")
            .trim();
          const review_stars = parseFloat(
            jQuery(row)
              .find(".stars-rating")
              .attr("class")
              .replace(/.*icon-stars_([\d]+).*/, `$1`)
              .replace(/5$/, ".5")
              .replace(/0/, "")
          );
          const review_text = jQuery(row)
            .find(".review-text")
            .text()
            .trim()
            .replace(/\s+/g, " ");
          const helpful = parseInt(
            jQuery(row)
              .find(".helpful-btn-container")
              .children("button")
              .first()
              .text()
              .trim()
              .replace(/.+\(([^)]+)\)/, `$1`)
          );
          return { title, posted_date, review_stars, review_text, helpful };
        })
        .get();
    });
    return ret;
  }

  async function flip_review_pager_action(page) {
    await page.waitForFunction(
      () => {
        return jQuery(".paging").children("button.arrow-button").length === 2;
      },
      { timeout: 90000 }
    );
    const no_more = await page.evaluate(() => {
      const no_more = jQuery(".paging")
        .children("button.arrow-button")
        .last()
        .prev("button")
        .hasClass("selected-page");
      return no_more;
    });
    if (!no_more) {
      const next_button = (await page.$x(
        "//div[@class='paging']/button[@class='arrow-button'][last()]"
      ))[0];
      await next_button.click();
      await page.waitForFunction(
        () => {
          return jQuery("div.loader").length == 0;
        },
        { timeout: 90000 }
      );
    }
    return no_more;
  }

  async function change_location(page) {
    console.log("change location");
    const flag = await page.evaluate(() => {
      return jQuery(".country-select > .country-code-flag")
        .text()
        .trim();
    });
    if (flag != "US") {
      console.log(flag);
      await page.click(".country-select");
      await page.waitFor(2000);
      await page.waitForSelector(".select-country > .search-input");
      await page.click(".select-country > .search-input");
      await page.waitFor(3000);
      //await page.waitForSelector(".select-country > .search-list", visible=True)
      const option_us = (await page.$x(
        "//div[contains(@class, 'select-country')]/div[contains(@class, 'search-list')]//div[@data-val='US'][1]"
      ))[0];
      await option_us.click();

      await page.waitFor(1000);
      await page.waitForSelector(".country-column > .save-selection");

      page.click(".country-column > .save-selection");
      await page.waitForNavigation({ timeout: 90000 });
    }
    console.log("change location end");
  }
  await main();
})();
