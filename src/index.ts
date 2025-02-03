import axios from "axios";
import Parser from "rss-parser";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const parser = new Parser();
const MASTODON_API_URL = "https://social.nove-b.dev/api/v1/statuses";
const ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

const rssUrls = [
  "https://blog.nove-b.dev/index.xml",
  "https://user-first.ikyu.co.jp/rss",
  "https://b.hatena.ne.jp/hotentry/it.rss",
  "https://2week.net/feed/",
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCzmxo1Zj4KkM32FlObFWdeA",
  "https://zenn.dev/topics/go/feed",
  "https://zenn.dev/topics/typescript/feed",
  "https://zenn.dev/topics/reactnative/feed",
  "https://zenn.dev/topics/nextjs/feed",
  "https://zenn.dev/topics/個人開発/feed",
  "https://www.its-kenpo.or.jp/NEWS/rss.xml",
];

const POSTED_URLS_FILE = "posted_urls.json";

// 投稿済みURLを読み込む
function loadPostedUrls(): Set<string> {
  try {
    if (!fs.existsSync(POSTED_URLS_FILE)) {
      console.log(`File ${POSTED_URLS_FILE} does not exist. Creating a new one.`);
      fs.writeFileSync(POSTED_URLS_FILE, JSON.stringify([], null, 2), "utf8");
      console.log(`${POSTED_URLS_FILE} successfully created.`);
    }
    const data = fs.readFileSync(POSTED_URLS_FILE, "utf8");
    return new Set(JSON.parse(data));
  } catch (error) {
    console.error("Error loading posted URLs:", error);
    return new Set();
  }
}

// 投稿済みURLを保存する
function savePostedUrls(postedUrls: Set<string>) {
  try {
    fs.writeFileSync(POSTED_URLS_FILE, JSON.stringify([...postedUrls], null, 2), "utf8");
    console.log(`Updated ${POSTED_URLS_FILE}`);
  } catch (error) {
    console.error("Error saving posted URLs:", error);
  }
}



async function fetchAndPost() {
  try {
    const postedUrls = loadPostedUrls();

    for (const url of rssUrls) {

      const feed = await parser.parseURL(encodeURI(url));
      if (feed.items.length === 0) {
        console.log(`No items found in RSS feed: ${url}`);
        continue;
      }

      let hasNewPost = false;

      for (const post of feed.items) {
        if (!post.link || postedUrls.has(post.link)) {
          continue;
        }

        const status = `🎉 ${post.title} 🎉\n🔗 ${post.link}`;
        try {
          const response = await axios.post(
            MASTODON_API_URL,
            { status, visibility: "public" },
            {
              headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
          console.log(`Successfully posted: ${post.title}`, response.data);
        } catch (error:any) {
          console.error("Error posting to Mastodon:", error.response?.data || error.message);
        }
        postedUrls.add(post.link);
        hasNewPost = true;
      }

      if (hasNewPost) {
        savePostedUrls(postedUrls);
      }
    }
  } catch (error) {
    console.error("Error fetching or posting RSS:", error);
  }
}


// 定期実行（30分ごと）
setInterval(fetchAndPost, 30 * 60 * 1000);

// 初回実行
fetchAndPost();
