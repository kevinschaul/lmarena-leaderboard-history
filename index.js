const fs = require("fs");
const cheerio = require("cheerio");
const got = require("got");
const csv = require("csv");
const { isEqual, uniqWith, sortBy } = require("lodash");

(async () => {
  const FILENAME = "history.csv";

  const getTable = async () => {
    const url = `https://lmarena.ai/leaderboard/text`;
    const { body } = await got.get(url);
    const $ = cheerio.load(body);

    const header = $('[data-sentry-component="LeaderboardHeader"]');
    // Not the best selector, but it's the first mono text in the header
    const dateText = header.find(".font-mono").eq(0).text();

    // Parse and format date to YYYY-MM-DD, fallback to raw text if parsing fails
    let date = dateText;
    const parsedDate = new Date(dateText);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate.toISOString().split('T')[0];
    }

    const rowItems = $(
      '[data-sentry-component="LeaderboardDataTable"] table tbody tr',
    );
    const rows = rowItems
      .map((i, el) => {
        const $el = $(el);

        return {
          date,
          rank: $el.find("td").eq(0).text(),
          model: $el.find("td").eq(2).find("a").text(),
          // Sometimes this field has a button but we don't want that
          score: $el
            .find("td")
            .eq(3)
            .clone()
            .find("button")
            .remove()
            .end()
            .text(),
          ci95: $el.find("td").eq(4).text(),
          votes: $el.find("td").eq(5).text(),
          organization: $el.find("td").eq(6).text(),
          license: $el.find("td").eq(7).text(),
        };
      })
      .toArray();
    return rows;
  };

  const data = await getTable();

  let previousData = [];
  try {
    const file = fs.readFileSync(FILENAME, "utf-8");
    previousData = await new Promise((resolve, reject) => {
      csv.parse(file, { columns: true, cast: false }, (e, d) => {
        resolve(d);
      });
    });
  } catch (e) {}

  const combined = uniqWith(data.concat(previousData), isEqual);

  const sorted = sortBy(combined, [(d) => -d.date, (d) => d.score]);

  const csvString = await new Promise((resolve, reject) => {
    csv.stringify(sorted, { header: true }, function (e, d) {
      resolve(d);
    });
  });
  fs.writeFileSync(FILENAME, csvString);
})();
