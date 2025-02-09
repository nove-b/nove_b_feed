import axios from "axios";
import Parser from "rss-parser";
import dotenv from "dotenv";
import fs from "fs";

type Feed = {
  title: string;
  url: string;
  tags: string[];
};

dotenv.config();

const parser = new Parser();
const MASTODON_API_URL = "https://social.nove-b.dev/api/v1/statuses";
const ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;
const RSS_API_URL = "https://api.sssapi.app/oTXr6SdpKDfqNyTXBCq_M";

const POSTED_URLS_FILE = "posted_urls.json";

// RSS フィード URL を取得
async function fetchRssUrls(): Promise<Feed[]> {
  try {
    const response = await axios.get(RSS_API_URL);
    return response.data.map((item: { titile: string; url: string; tags: string[] }) => ({
      title: item.titile, // APIのtypoを修正
      url: item.url,
      tags: item.tags || [],
    }));
  } catch (error) {
    console.error("Error fetching RSS URLs:", error);
    return [];
  }
}

// 投稿済みURLを読み込む
function loadPostedUrls(): Set<string> {
  try {
    if (!fs.existsSync(POSTED_URLS_FILE)) {
      fs.writeFileSync(POSTED_URLS_FILE, JSON.stringify([], null, 2), "utf8");
    }
    return new Set(JSON.parse(fs.readFileSync(POSTED_URLS_FILE, "utf8")));
  } catch (error) {
    console.error("Error loading posted URLs:", error);
    return new Set();
  }
}

// 投稿済みURLを保存する
function savePostedUrls(postedUrls: Set<string>) {
  try {
    fs.writeFileSync(POSTED_URLS_FILE, JSON.stringify([...postedUrls], null, 2), "utf8");
  } catch (error) {
    console.error("Error saving posted URLs:", error);
  }
}

// RSS を取得して Mastodon に投稿
async function fetchAndPost() {
  try {
    const rssSources = await fetchRssUrls();
    if (rssSources.length === 0) {
      console.error("No RSS sources available.");
      return;
    }

    const postedUrls = loadPostedUrls();

    for (const { title, url, tags } of rssSources) {
      const feed = await parser.parseURL(encodeURI(url));
      if (feed.items.length === 0) continue;

      let hasNewPost = false;

      for (const post of feed.items) {
        if (!post.link || postedUrls.has(post.link)) continue;

        const tagString = tags.length > 0 ? `\n${tags.map(tag => `#${tag}`).join(" ")}` : "";
        const status = `📢 ${title}\n📝 ${post.title}\n🔗 ${post.link}\n${tagString}`;

        try {
          await axios.post(
            MASTODON_API_URL,
            { status, visibility: "public" },
            {
              headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
          console.log(`Posted: ${post.title}`);
          postedUrls.add(post.link);
          hasNewPost = true;
        } catch (error: any) {
          console.error("Error posting to Mastodon:", error.response?.data || error.message);
        }
      }

      if (hasNewPost) {
        savePostedUrls(postedUrls);
      }
    }
  } catch (error) {
    console.error("Error fetching or posting RSS:", error);
  }
}

// 30分ごとに実行
setInterval(fetchAndPost, 30 * 60 * 1000);
fetchAndPost();
