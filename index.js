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
          await page.waitFor(3000);
          let page_count = (await browser.pages()).length;
          console.log("out", page_count);
          while (page_count > 7) {
            page_count = (await browser.pages()).length;
            console.log("in", page_count);
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
        interceptedRequest.url().endsWith(".jpg") ||
        interceptedRequest
          .url()
          .search(
            /google\.com|googleadservices\.com|google-analytics\.com|googletagmanager\.com|facebook\.net|pinimg\.com|doubleclick/
          ) != -1
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
    await page.goto(url, { timeout: 90003 });
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
    try {
      await page.goto(url, { timeout: 90004 });
    } catch (ex) {
      console.log("get product list timeout reload");
      console.log(url);
      await get_product_list_one_page(page, url);
    }

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
    try {
      await page.goto(url, { timeout: 90005 });
    } catch (ex) {
      console.log("product page timeout, close and reopen");
      await page.close();
      await grab_product_detail(browser, url);
    }

    let has_review = true;
    try {
      await page.waitForFunction(
        () => {
          return jQuery(".product-description-title")
            .last()
            .find(".rating-count").length;
        },
        { timeout: 90006 }
      );
    } catch (ex) {
      console.log("no review, pass to next...");
      console.log(url);
      has_review = false;
    }
    let product_part1 = {
      product_stars: "",
      reviews_count: "",
      review_url: ""
    };
    if (has_review) {
      product_part1 = await page.evaluate(() => {
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
        const review_url = jQuery(".product-description-title")
          .last()
          .find(".rating-count")
          .attr("href");
        return { product_stars, reviews_count, review_url };
      });
    }

    const product_part2 = await page.evaluate(url => {
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

      const product_url = url;

      return {
        brand,
        source,
        category,
        description,
        name,
        sku,
        upc,
        image,
        product_url
      };
    }, url);
    // const product = { ...product_part1, ...product_part2 };
    const reviews = await grab_product_review(
      page,
      product_part1["review_url"]
    );

    for (let i = 0; i < reviews.length; i++) {
      reviews[i] = { ...reviews[i], ...product_part1, ...product_part2 };
    }
    await page.close();
    return reviews;
  }

  async function grab_product_review(page, url) {
    let reviews = [];
    if (!url) return reviews;
    try {
      await page.goto(url, { timeout: 90007 });
    } catch (ex) {
      console.log("review page time out error, reload");
      console.log(url);
      await grab_product_review(page, url);
    }
    const empty_review = await page.evaluate(() => {
      return jQuery("div.empty-reviews-section").length;
    });
    if (empty_review) {
      console.log("empty review");
      console.log(url);
      return reviews;
    }

    while (true) {
      let ret = await grab_product_review_one_page(page);
      reviews = reviews.concat(ret);
      try {
        if ((await flip_review_pager_action(page)) == true) {
          break;
        }
      } catch (ex) {
        console.log("flip error, reload");
        console.log(url);
        await grab_product_review(page, url);
      }
    }
    return reviews;
  }

  async function grab_product_review_one_page(page) {
    try {
      await page.waitForSelector(".reviews-list", { timeout: 90008 });
    } catch (ex) {
      console.log("reviews list timeout rewati");
      console.log(page.url());
      await grab_product_reviconew_one_page(page);
    }

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
        { timeout: 90001 }
      );
    }
    return no_more;
  }

  async function change_location(page) {
    console.log("change location");
    const is_us = await page.evaluate(() => {
      return (
        jQuery(".country-select")
          .text()
          .trim() == "US" &&
        jQuery(".language-select")
          .text()
          .trim() == "EN" &&
        jQuery(".currency-select")
          .text()
          .trim() == "USD"
      );
    });
    if (!is_us) {
      console.log("changing language");
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

      await page.waitForFunction(() => {
        return (
          jQuery("#CurrentLanguageCode").attr("value") == "en-US" &&
          jQuery("#CurrentCurrencyCode").attr("value") == "USD"
        );
      });
      await page.waitForSelector(".country-column > .save-selection");
      page.click(".country-column > .save-selection");
      await page.waitForNavigation({ timeout: 90002 });
    }
    console.log("change location end");
  }
  await main();
})();
