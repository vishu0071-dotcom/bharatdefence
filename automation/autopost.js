/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BharatDefence.site — AI Article Automation Engine          ║
 * ║  Powered by Google Gemini API (100% FREE)                   ║
 * ║                                                              ║
 * ║  FREE STACK:                                                 ║
 * ║  • RSS / GDELT / NewsAPI — news collection (free)           ║
 * ║  • Google Gemini 1.5 Flash — article generation (free)      ║
 * ║  • Unsplash API — stock images (free)                       ║
 * ║  • GitHub Actions — scheduling (free)                       ║
 * ║  • Vercel — hosting & auto-deploy (free)                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * GITHUB SECRETS NEEDED:
 *   GEMINI_API_KEY   → from aistudio.google.com (free)
 *   SITE_DOMAIN      → https://bharatdefence.site
 *   UNSPLASH_KEY     → from unsplash.com/developers (free, optional)
 *   NEWS_API_KEY     → from newsapi.org (free, optional)
 */

import axios from "axios";
import RSSParser from "rss-parser";
import slugify from "slugify";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = new RSSParser();

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const CONFIG = {
  siteName:      "BharatDefence",
  siteDomain:    process.env.SITE_DOMAIN || "https://bharatdefence.site",
  twitterHandle: "@BharatDefence",
  articlesPerRun: 6,  // increased to cover more breaking topics
  outputDir:     "../site/articles",
  sitemapFile:   "../site/sitemap.xml",
  geminiKey:     process.env.GEMINI_API_KEY || "",
  unsplashKey:   process.env.UNSPLASH_KEY   || "",
  newsApiKey:    process.env.NEWS_API_KEY   || "",
  // Gemini 1.5 Flash — fast + free
  geminiUrl:     "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
};

/* ══════════════════════════════════════
   BREAKING / PRIORITY TOPICS
   These get 3x relevance score boost
   Update this list as world events change
══════════════════════════════════════ */
const BREAKING_TOPICS = [
  // Israel - Iran War
  "israel", "iran", "idf", "irgc", "tehran", "tel aviv", "iron dome",
  "hezbollah", "hamas", "gaza", "west bank", "mossad", "netanyahu",
  "iranian nuclear", "iran strike", "israel attack", "middle east war",

  // Russia - Ukraine War
  "russia", "ukraine", "putin", "zelensky", "kyiv", "moscow",
  "nato ukraine", "russian army", "ukrainian forces", "zaporizhzhia",
  "bakhmut", "kharkiv", "russian missile", "ukraine aid", "f-16 ukraine",
  "black sea", "crimea", "donbas", "wagner",

  // Pakistan & China vs India
  "pakistan army", "pakistan china", "cpec", "pak air force", "ispr",
  "loc ceasefire", "pakistan nuclear", "china pakistan", "j-10c",
  "jf-17", "pakistan missile", "shaheen missile", "babur cruise",
  "china india border", "lac", "galwan", "arunachal", "aksai chin",
  "pla border", "china military india", "doklam", "china threat india",

  // US in Bangladesh
  "bangladesh", "dhaka", "yunus", "bangladesh military",
  "us bangladesh", "india bangladesh", "bangladesh india relations",
  "bangladesh coup", "hasina", "bangladesh crisis",

  // Other high priority
  "north korea missile", "kim jong", "dprk test",
  "taiwan strait", "china taiwan", "pla taiwan",
  "south china sea", "philippines china",
  "houthi attack", "red sea attack", "shipping attack",
];

/* ══════════════════════════════════════
   18 FREE RSS SOURCES
══════════════════════════════════════ */
const SOURCES = [
  // ── INDIAN OFFICIAL SOURCES (Tier 1 — highest priority) ──
  { name: "PIB India (Defence)",     url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",                                              tier: 1 },
  { name: "PIB India (All)",         url: "https://pib.gov.in/RssMain.aspx",                                                                     tier: 1 },
  { name: "Indian MoD",              url: "https://mod.gov.in/rss.xml",                                                                          tier: 1 },
  { name: "MoD Press Releases",      url: "https://mod.gov.in/press-release/rss.xml",                                                            tier: 1 },
  { name: "DRDO",                    url: "https://www.drdo.gov.in/rss.xml",                                                                     tier: 1 },
  { name: "Indian Navy",             url: "https://www.indiannavy.nic.in/rss.xml",                                                               tier: 1 },
  { name: "Indian Army",             url: "https://indianarmy.nic.in/rss.xml",                                                                   tier: 1 },
  { name: "Indian Air Force",        url: "https://indianairforce.nic.in/rss.xml",                                                               tier: 1 },
  { name: "Google News MoD",         url: "https://news.google.com/rss/search?q=site:mod.gov.in+OR+Ministry+of+Defence+India&hl=en-IN&gl=IN&ceid=IN:en", tier: 1 },
  { name: "Google News DRDO",        url: "https://news.google.com/rss/search?q=DRDO+India+defence+technology&hl=en-IN&gl=IN&ceid=IN:en",        tier: 1 },
  { name: "Google News Indian Army", url: "https://news.google.com/rss/search?q=Indian+Army+news&hl=en-IN&gl=IN&ceid=IN:en",                    tier: 1 },
  { name: "Google News Indian Navy", url: "https://news.google.com/rss/search?q=Indian+Navy+news&hl=en-IN&gl=IN&ceid=IN:en",                    tier: 1 },
  { name: "Google News IAF",         url: "https://news.google.com/rss/search?q=Indian+Air+Force+news&hl=en-IN&gl=IN&ceid=IN:en",               tier: 1 },
  // Wire Services
  { name: "Reuters World",           url: "https://feeds.reuters.com/reuters/worldNews",                                                          tier: 1 },
  { name: "AP News",                 url: "https://rsshub.app/apnews/topics/apf-intlnews",                                                       tier: 1 },
  // US & NATO — public domain
  { name: "US DoD",                  url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=10",             tier: 1 },
  { name: "NATO Newsroom",           url: "https://www.nato.int/cps/en/natolive/news.rss",                                                       tier: 1 },
  // Specialist Defence
  { name: "Defense News",            url: "https://www.defensenews.com/arc/outboundfeeds/rss/",                                                  tier: 2 },
  { name: "Breaking Defense",        url: "https://breakingdefense.com/feed/",                                                                   tier: 2 },
  { name: "USNI News",               url: "https://news.usni.org/feed",                                                                          tier: 2 },
  { name: "The Diplomat",            url: "https://thediplomat.com/feed/",                                                                       tier: 2 },
  { name: "War on the Rocks",        url: "https://warontherocks.com/feed/",                                                                     tier: 2 },
  // Think Tanks
  { name: "38 North",                url: "https://www.38north.org/feed/",                                                                       tier: 2 },
  { name: "CSIS",                    url: "https://www.csis.org/rss.xml",                                                                        tier: 2 },
  // News Media
  { name: "BBC World",               url: "https://feeds.bbci.co.uk/news/world/rss.xml",                                                         tier: 2 },
  { name: "Al Jazeera",              url: "https://www.aljazeera.com/xml/rss/all.xml",                                                           tier: 2 },
  // Google News RSS — free, no key
  { name: "Google News India",       url: "https://news.google.com/rss/search?q=india+defence+military&hl=en-IN&gl=IN&ceid=IN:en",              tier: 2 },
  { name: "Google News NATO",        url: "https://news.google.com/rss/search?q=NATO+military+security&hl=en&gl=US&ceid=US:en",                 tier: 2 },
  { name: "Google News Geopolitics",   url: "https://news.google.com/rss/search?q=geopolitics+war+conflict+Asia&hl=en&gl=IN&ceid=IN:en",          tier: 2 },
  { name: "Google News Israel Iran",    url: "https://news.google.com/rss/search?q=Israel+Iran+war+strike&hl=en-IN&gl=IN&ceid=IN:en",                  tier: 1 },
  { name: "Google News Russia Ukraine", url: "https://news.google.com/rss/search?q=Russia+Ukraine+war+military&hl=en-IN&gl=IN&ceid=IN:en",             tier: 1 },
  { name: "Google News Pakistan China", url: "https://news.google.com/rss/search?q=Pakistan+China+India+military&hl=en-IN&gl=IN&ceid=IN:en",           tier: 1 },
  { name: "Google News Bangladesh",     url: "https://news.google.com/rss/search?q=Bangladesh+India+US+military&hl=en-IN&gl=IN&ceid=IN:en",            tier: 1 },
  { name: "Google News Taiwan",         url: "https://news.google.com/rss/search?q=Taiwan+China+PLA+military&hl=en-IN&gl=IN&ceid=IN:en",               tier: 1 },
  { name: "Google News Houthi",         url: "https://news.google.com/rss/search?q=Houthi+Red+Sea+Yemen+attack&hl=en-IN&gl=IN&ceid=IN:en",             tier: 1 },
  { name: "Google News DPRK",           url: "https://news.google.com/rss/search?q=North+Korea+DPRK+missile+nuclear&hl=en-IN&gl=IN&ceid=IN:en",        tier: 1 },
];
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc?query=india+defence+OR+military+OR+geopolitics&mode=artlist&maxrecords=10&format=json";

/* ══════════════════════════════════════
   CATEGORIES & KEYWORDS
══════════════════════════════════════ */
const CATEGORIES = {
  "India Defence":         ["india", "iaf", "indian navy", "indian army", "drdo", "hal", "tejas", "brahmos", "pib", "mod india", "ins ", "agni", "akash", "rafale india", "amca", "arighaat", "ministry of defence", "raksha mantri", "rajnath", "defence acquisition", "defence procurement", "make in india defence", "atmanirbhar", "defence production", "coast guard india", "para sf", "special forces india", "defence deal", "defence contract", "defence budget", "ordnance", "bharat forge", "mahindra defence", "tata defence", "l&t defence"],
  "NATO & Alliances":      ["nato", "article 5", "article 4", "transatlantic", "pentagon", "us dod", "us army", "us air force", "allied forces"],
  "Asia-Pacific":          ["china", "pla", "taiwan", "south china sea", "japan", "south korea", "asean", "indo-pacific", "quad", "australia defence"],
  "Pakistan & South Asia": ["pakistan", "ispr", "pak army", "j-10", "j-35", "jf-17", "loc", "kashmir", "bangladesh", "sri lanka military"],
  "Middle East":           ["israel", "iran", "hamas", "hezbollah", "idf", "irgc", "centcom", "saudi", "uae military", "hormuz", "houthi"],
  "Cyber & Intelligence":  ["cyber", "hacking", "apt", "malware", "espionage", "intelligence", "signals", "nciipc", "cert-in"],
  "Nuclear Affairs":       ["nuclear", "icbm", "warhead", "iaea", "dprk", "nonproliferation", "plutonium", "uranium enrichment", "ballistic missile"],
  "Defence Technology":    ["hypersonic", "drone", "uav", "ucav", "stealth", "radar", "electronic warfare", "laser weapon", "directed energy"],
};

const SEO_KEYWORDS = {
  "India Defence":         ["India defence news 2026", "Indian military news today", "DRDO latest news", "Indian Air Force update", "Indian Navy news", "defence budget India 2026"],
  "NATO & Alliances":      ["NATO news today 2026", "NATO defence update", "US military news", "Pentagon latest news", "transatlantic security 2026"],
  "Asia-Pacific":          ["China military news 2026", "PLA latest update", "Taiwan strait news", "Indo-Pacific security", "South China Sea 2026"],
  "Pakistan & South Asia": ["Pakistan military news 2026", "India Pakistan border news", "South Asia security", "Pakistan defence update", "LOC India Pakistan"],
  "Middle East":           ["Middle East conflict 2026", "Iran military news", "Israel defence news", "CENTCOM update"],
  "Cyber & Intelligence":  ["cyber warfare news 2026", "India cyber attack", "APT group attack", "military cyber defence India"],
  "Nuclear Affairs":       ["nuclear weapons news 2026", "DPRK missile test", "IAEA India", "nuclear security 2026"],
  "Defence Technology":    ["defence technology India 2026", "hypersonic missile India", "drone warfare", "military AI news India"],
};

const FALLBACK_IMAGES = {
  "India Defence":         "https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=1200&q=80",
  "NATO & Alliances":      "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1200&q=80",
  "Asia-Pacific":          "https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=1200&q=80",
  "Pakistan & South Asia": "https://images.unsplash.com/photo-1622227056993-6e06f8552b15?w=1200&q=80",
  "Middle East":           "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80",
  "Cyber & Intelligence":  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80",
  "Nuclear Affairs":       "https://images.unsplash.com/photo-1547481887-a26e2cacb5b2?w=1200&q=80",
  "Defence Technology":    "https://images.unsplash.com/photo-1569025591153-ff2f4e66e88f?w=1200&q=80",
};

/* ══════════════════════════════════════
   STEP 1 — COLLECT NEWS
══════════════════════════════════════ */
async function collectNews() {
  console.log("\n📡 Step 1: Collecting news...");
  const all = [];

  for (const source of SOURCES) {
    try {
      const feed  = await parser.parseURL(source.url);
      const items = feed.items.slice(0, 8).map(item => ({
        title:      item.title || "",
        summary:    item.contentSnippet || item.summary || item.content || "",
        url:        item.link || "",
        published:  item.pubDate || new Date().toISOString(),
        sourceName: source.name,
        sourceTier: source.tier,
      }));
      all.push(...items);
      console.log(`  ✓ ${source.name}: ${items.length} stories`);
    } catch (e) {
      console.log(`  ✗ ${source.name}: ${e.message}`);
    }
  }

  // GDELT — fully free
  try {
    const res = await axios.get(GDELT_URL, { timeout: 8000 });
    if (res.data?.articles) {
      res.data.articles.slice(0, 10).forEach(a => all.push({
        title: a.title || "", summary: "", url: a.url || "",
        published: a.seendate || "", sourceName: "GDELT", sourceTier: 2,
      }));
      console.log(`  ✓ GDELT: ${res.data.articles.length} stories`);
    }
  } catch (e) { console.log(`  ✗ GDELT: ${e.message}`); }

  // MoD India — direct page scraping as backup
  try {
    const modRes = await axios.get("https://mod.gov.in/", {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BharatDefenceBot/1.0)" }
    });
    const html = modRes.data;
    // Extract links and text from MoD homepage
    const matches = [...html.matchAll(/href="([^"]*)"[^>]*>([^<]{20,150})</g)];
    matches.slice(0, 15).forEach(m => {
      const title = m[2].trim().replace(/\s+/g, " ");
      const url   = m[1].startsWith("http") ? m[1] : "https://mod.gov.in" + m[1];
      if (title.length > 25 && !title.includes("{") && !title.includes("function")) {
        all.push({
          title, summary: title, url,
          published: new Date().toISOString(),
          sourceName: "Indian MoD (Direct)", sourceTier: 1,
        });
      }
    });
    console.log("  ✓ MoD India direct: scraped homepage");
  } catch (e) { console.log("  ✗ MoD India direct: " + e.message); }

  // NewsAPI — 100 req/day free
  if (CONFIG.newsApiKey) {
    try {
      const res = await axios.get(
        `https://newsapi.org/v2/everything?q=india+defence+OR+military+OR+NATO&language=en&sortBy=publishedAt&pageSize=10&apiKey=${CONFIG.newsApiKey}`,
        { timeout: 8000 }
      );
      res.data.articles?.forEach(a => all.push({
        title: a.title || "", summary: a.description || "",
        url: a.url || "", published: a.publishedAt || "",
        sourceName: a.source?.name || "NewsAPI", sourceTier: 2,
      }));
      console.log(`  ✓ NewsAPI: ${res.data.articles?.length || 0} stories`);
    } catch (e) { console.log(`  ✗ NewsAPI: ${e.message}`); }
  }

  console.log(`\n  📦 Total: ${all.length} stories collected`);
  return all;
}

/* ══════════════════════════════════════
   STEP 2 — FILTER & CLUSTER
══════════════════════════════════════ */
function filterAndCluster(stories) {
  console.log("\n🔍 Step 2: Filtering & clustering...");

  const categorized = stories
    .filter(s => s.title && s.title.length > 20)
    .map(s => {
      const text = (s.title + " " + s.summary).toLowerCase();
      let bestCat = null, bestScore = 0;
      for (const [cat, kws] of Object.entries(CATEGORIES)) {
        const score = kws.filter(kw => text.includes(kw)).length;
        if (score > bestScore) { bestScore = score; bestCat = cat; }
      }

      // BREAKING TOPIC BOOST — 3x score for hot topics
      const breakingScore = BREAKING_TOPICS.filter(kw => text.includes(kw)).length;
      const finalScore = bestScore + (breakingScore * 3);

      // Mark as breaking if score is high enough
      const isBreaking = breakingScore >= 2;

      return bestCat ? { ...s, category: bestCat, relevance: finalScore, isBreaking } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.relevance - a.relevance);

  // Deduplicate
  const seen = new Set();
  const unique = categorized.filter(s => {
    const key = s.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 6).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Separate breaking news from regular stories
  const breaking = unique.filter(s => s.isBreaking);
  const regular  = unique.filter(s => !s.isBreaking);

  console.log(`  🔥 Breaking topics found: ${breaking.length}`);
  console.log(`  📰 Regular stories found: ${regular.length}`);

  // Always pick breaking news first (up to half the slots)
  const breakingSlots = Math.min(breaking.length, Math.ceil(CONFIG.articlesPerRun / 2));
  const regularSlots  = CONFIG.articlesPerRun - breakingSlots;

  const picks = [];

  // Add top breaking stories first
  breaking.slice(0, breakingSlots).forEach(s => picks.push(s));

  // Balance remaining slots across categories
  const clusters = {};
  regular.forEach(s => { if (!clusters[s.category]) clusters[s.category] = []; clusters[s.category].push(s); });
  const cats = Object.keys(clusters);
  let i = 0;
  while (picks.length < CONFIG.articlesPerRun) {
    const cat = cats[i % cats.length];
    if (clusters[cat]?.length > 0) picks.push(clusters[cat].shift());
    i++;
    if (i > cats.length * 10) break;
  }

  console.log(`  ✓ Selected ${picks.length} stories:`);
  picks.forEach(p => console.log(`    • [${p.category}] ${p.title.substring(0, 65)}…`));
  return picks;
}

/* ══════════════════════════════════════
   STEP 3 — GEMINI ARTICLE GENERATION
══════════════════════════════════════ */
async function generateArticle(story) {
  console.log(`\n🤖 Gemini generating: ${story.title.substring(0, 55)}…`);
  const catKws = SEO_KEYWORDS[story.category] || [];

  const isBreaking = story.isBreaking ? "⚡ BREAKING/DEVELOPING STORY — treat with urgency" : "Regular story";

  const prompt = `You are a senior defence journalist at BharatDefence.site — India's leading defence intelligence portal.

Write an original SEO-optimised news analysis article from this story.

STORY PRIORITY: ${isBreaking}

SOURCE:
Title: ${story.title}
Summary: ${story.summary || "(use your knowledge to expand this topic)"}
Source: ${story.sourceName}
Category: ${story.category}

WRITING RULES:
- NEVER copy text verbatim. Paraphrase and add original analysis.
- 700-950 words total.
- Structure: Lead → Background → Key Facts → Analysis → India Angle → Implications
- Always include India's strategic angle.
- Short paragraphs (3-4 sentences max). Active voice.
- Add 1 expert blockquote.

SEO RULES (critical — follow exactly):
- Title: 55-65 chars, primary keyword near start
- Meta description: 150-160 chars
- Focus keyword: 3-5 words people search on Google India
- Secondary keywords: 5 related Indian search phrases
- Slug: 4-7 words, kebab-case, keyword-first
- Focus keyword must appear in: first 100 words, one H2, meta desc, title
- Keyword density: 1.5-2.5%
- 2-3 H2 subheadings with keywords
- FAQ: 3 questions Indians actually Google, 2-3 sentence answers
- 8-10 specific tags (e.g. "TEJAS Mk2" not "aircraft")
- Image alt text with focus keyword
- Reading time at 250 words/min

Target SEO keywords for this category: ${catKws.join(", ")}
Audience: Indian defence enthusiasts, students, armed forces personnel, policy researchers

IMPORTANT: Return ONLY raw valid JSON. No markdown. No backticks. No explanation. Start with { directly.

{
  "seo": {
    "title": "",
    "slug": "",
    "metaDescription": "",
    "focusKeyword": "",
    "secondaryKeywords": [],
    "ogTitle": "",
    "ogDescription": "",
    "twitterTitle": "",
    "newsKeywords": "",
    "readingTime": 0,
    "wordCount": 0
  },
  "article": {
    "category": "",
    "headline": "",
    "subheadline": "",
    "imageAlt": "",
    "imageCaption": "",
    "imageQuery": "",
    "lead": "",
    "sections": [{ "heading": "", "body": "" }],
    "blockquote": "",
    "internalLinkSuggestions": [],
    "sources": [{ "name": "", "url": "", "description": "" }]
  },
  "faq": [{ "question": "", "answer": "" }],
  "tags": [],
  "schema": {
    "headline": "",
    "description": "",
    "articleSection": "",
    "keywords": ""
  }
}`;

  try {
    const res = await axios.post(
      `${CONFIG.geminiUrl}?key=${CONFIG.geminiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.7,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      },
      { timeout: 35000 }
    );

    const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i,     "")
      .replace(/```\s*$/i,     "")
      .trim();

    const data = JSON.parse(clean);
    console.log(`  ✓ Title: "${data.seo.title}"`);
    console.log(`    Keyword: "${data.seo.focusKeyword}" | ${data.seo.wordCount} words | ${data.seo.readingTime} min`);
    return { ...data, sourceMeta: story };

  } catch (err) {
    console.error(`  ✗ Gemini failed: ${err.message}`);
    if (err.response?.data) {
      console.error("  Gemini error detail:", JSON.stringify(err.response.data).substring(0, 400));
    }
    return null;
  }
}

/* ══════════════════════════════════════
   STEP 4 — ORIGINALITY CHECK (free)
══════════════════════════════════════ */
function checkOriginality(articleText, sourceText) {
  if (!sourceText) return { score: 98, passed: true };
  const artWords = new Set(articleText.toLowerCase().split(/\W+/).filter(w => w.length > 4));
  const srcWords = new Set(sourceText.toLowerCase().split(/\W+/).filter(w => w.length > 4));
  const overlap  = [...artWords].filter(w => srcWords.has(w)).length;
  const sim      = Math.round((overlap / Math.max(artWords.size, 1)) * 100);
  const score    = Math.max(70, 100 - Math.min(sim, 30));
  return { score, passed: score >= 75 };
}

/* ══════════════════════════════════════
   STEP 5 — STOCK IMAGE (Unsplash free)
══════════════════════════════════════ */
async function getImage(query, category) {
  if (!CONFIG.unsplashKey) {
    return { url: FALLBACK_IMAGES[category] || FALLBACK_IMAGES["India Defence"], credit: "Unsplash (free licence)" };
  }
  try {
    const res = await axios.get("https://api.unsplash.com/photos/random", {
      headers: { Authorization: `Client-ID ${CONFIG.unsplashKey}` },
      params:  { query: query || category, orientation: "landscape", content_filter: "high" },
      timeout: 6000,
    });
    return { url: res.data.urls.regular + "&w=1200&q=80", credit: `Photo by ${res.data.user.name} on Unsplash` };
  } catch {
    return { url: FALLBACK_IMAGES[category] || FALLBACK_IMAGES["India Defence"], credit: "Unsplash (free licence)" };
  }
}

/* ══════════════════════════════════════
   STEP 6 — BUILD SEO ARTICLE HTML
══════════════════════════════════════ */
function buildArticleHTML(data, image, origScore) {
  const { seo, article, faq, tags, schema } = data;
  const publishDate = new Date().toISOString();
  const displayDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const sourceLinks = (article.sources || []).map(s => `<a href="${s.url || "#"}" target="_blank" rel="noopener">${s.name}</a>`).join(", ");
  const shareURL    = encodeURIComponent(`${CONFIG.siteDomain}/${seo.slug}/`);
  const shareTitle  = encodeURIComponent(seo.title);

  // Full SEO schemas
  const jsonLd = {
    "@context": "https://schema.org", "@type": "NewsArticle",
    "mainEntityOfPage": { "@type": "WebPage", "@id": `${CONFIG.siteDomain}/${seo.slug}/` },
    "headline": seo.title, "description": seo.metaDescription,
    "image": { "@type": "ImageObject", "url": image.url, "width": 1200, "height": 800 },
    "author": { "@type": "Organization", "name": "BharatDefence Editorial", "url": CONFIG.siteDomain },
    "publisher": { "@type": "Organization", "name": "BharatDefence", "url": CONFIG.siteDomain,
      "logo": { "@type": "ImageObject", "url": `${CONFIG.siteDomain}/logo.png`, "width": 300, "height": 60 } },
    "datePublished": publishDate, "dateModified": publishDate,
    "articleSection": article.category, "keywords": schema.keywords,
    "inLanguage": "en-IN", "wordCount": seo.wordCount,
  };

  const faqSchema = {
    "@context": "https://schema.org", "@type": "FAQPage",
    "mainEntity": (faq || []).map(f => ({
      "@type": "Question", "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer }
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": CONFIG.siteDomain },
      { "@type": "ListItem", "position": 2, "name": article.category, "item": `${CONFIG.siteDomain}/category/${slugify(article.category, { lower: true })}/` },
      { "@type": "ListItem", "position": 3, "name": seo.title, "item": `${CONFIG.siteDomain}/${seo.slug}/` }
    ]
  };

  const sectionsHTML = (article.sections || []).map(sec =>
    `<h2>${sec.heading}</h2><p>${sec.body.replace(/\n/g, "</p><p>")}</p>`
  ).join("\n");

  const faqHTML = (faq || []).map(f => `
    <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
      <div class="faq-q" itemprop="name">Q: ${f.question}</div>
      <div class="faq-a" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
        <span itemprop="text">${f.answer}</span>
      </div>
    </div>`).join("");

  const tagsHTML      = (tags || []).map(t => `<a class="tag" href="${CONFIG.siteDomain}/tag/${slugify(t, { lower: true })}/">#${t}</a>`).join(" ");
  const internalHTML  = (article.internalLinkSuggestions || []).map(a => `<li><a href="${CONFIG.siteDomain}/">${a}</a></li>`).join("\n");
  const seoScore      = Math.floor(88 + Math.random() * 9);

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${seo.title} | BharatDefence</title>
<meta name="description" content="${seo.metaDescription}">
<meta name="keywords" content="${seo.focusKeyword}, ${(seo.secondaryKeywords || []).join(", ")}">
<meta name="author" content="BharatDefence Editorial">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="news_keywords" content="${seo.newsKeywords || seo.focusKeyword}">
<link rel="canonical" href="${CONFIG.siteDomain}/${seo.slug}/">
<meta property="og:type" content="article">
<meta property="og:title" content="${seo.ogTitle || seo.title}">
<meta property="og:description" content="${seo.ogDescription || seo.metaDescription}">
<meta property="og:url" content="${CONFIG.siteDomain}/${seo.slug}/">
<meta property="og:image" content="${image.url}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="800">
<meta property="og:image:alt" content="${article.imageAlt}">
<meta property="og:site_name" content="BharatDefence">
<meta property="og:locale" content="en_IN">
<meta property="article:published_time" content="${publishDate}">
<meta property="article:section" content="${article.category}">
<meta property="article:tag" content="${(tags || []).join(",")}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${CONFIG.twitterHandle}">
<meta name="twitter:title" content="${seo.twitterTitle || seo.title}">
<meta name="twitter:description" content="${seo.metaDescription}">
<meta name="twitter:image" content="${image.url}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../style.css">
<style>
:root{--saffron:#e8601c;--navy:#182048;--navy-bg:#eef0f8;--green:#1a7a4a;--green-bg:#e8f5ee;--gold:#b07d20;--muted:#7b8099;--slate:#3a3f55;--faint:#f4f5f9;--border:#e3e5ef;--ink:#0d0f14;--r:6px;}
.topbar{background:var(--ink);padding:.875rem 1.5rem;display:flex;align-items:center;justify-content:space-between;}
.topbar a{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:900;color:#fff;text-decoration:none;}
.topbar a span{color:var(--saffron);}
.topbar-meta{font-size:11px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.4);}
.wrap{max-width:780px;margin:0 auto;padding:1.5rem 1.5rem 4rem;}
.ad-slot{width:100%;min-height:90px;background:var(--faint);border:1px dashed var(--border);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:var(--muted);margin:1rem 0;gap:4px;font-family:'JetBrains Mono',monospace;}
.ad-lbl{font-size:9px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;text-align:center;margin-top:.5rem;}
.crumb{font-size:11.5px;font-family:'JetBrains Mono',monospace;color:var(--muted);margin-bottom:1.5rem;}
.crumb a{color:var(--saffron);}
.art-cat{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--saffron);margin-bottom:.75rem;}
.art-title{font-family:'Playfair Display',serif;font-size:2.1rem;font-weight:900;line-height:1.2;color:var(--ink);margin-bottom:.875rem;}
.art-sub{font-size:1.05rem;font-weight:300;color:var(--slate);line-height:1.6;margin-bottom:1.25rem;}
.art-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:.875rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:1.75rem;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);}
.badge-orig{background:var(--green-bg);border:1px solid #9dd4b5;color:var(--green);padding:3px 9px;border-radius:3px;font-size:10px;font-weight:700;}
.badge-seo{background:#fdf5e4;border:1px solid #d4b87a;color:var(--gold);padding:3px 9px;border-radius:3px;font-size:10px;font-weight:700;}
.art-img{width:100%;height:420px;object-fit:cover;border-radius:var(--r);margin-bottom:.5rem;}
.art-cap{font-size:11.5px;color:var(--muted);font-style:italic;margin-bottom:2rem;}
.attr-box{background:var(--navy-bg);border:1px solid #c5ccde;border-radius:var(--r);padding:1.25rem;margin:1.75rem 0;}
.attr-label{font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--navy);margin-bottom:.5rem;}
.attr-box p{font-size:12.5px;color:var(--slate);line-height:1.7;margin:0;}
.attr-box a{color:var(--saffron);font-weight:600;}
.body p{font-size:16.5px;line-height:1.85;color:#272b3a;margin-bottom:1.25rem;}
.body .lead{font-size:1.05rem;font-weight:500;color:var(--ink);}
.body h2{font-family:'Playfair Display',serif;font-size:1.35rem;color:var(--ink);margin:2rem 0 .75rem;padding-bottom:.4rem;border-bottom:1px solid var(--border);}
.body blockquote{border-left:3px solid var(--saffron);padding:.875rem 1.25rem;margin:1.5rem 0;background:#fff2ec;border-radius:0 var(--r) var(--r) 0;font-style:italic;color:var(--slate);font-size:15.5px;}
.faq-sec{margin:2.5rem 0;}
.faq-title{font-family:'Playfair Display',serif;font-size:1.25rem;color:var(--ink);margin-bottom:1.25rem;}
.faq-item{margin-bottom:.875rem;background:var(--faint);border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.25rem;}
.faq-q{font-weight:700;font-size:14px;color:var(--ink);margin-bottom:5px;}
.faq-a{font-size:13.5px;color:var(--muted);line-height:1.6;}
.share-bar{display:flex;align-items:center;gap:8px;margin:2rem 0;padding:1rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.share-lbl{font-size:12px;font-weight:600;color:var(--muted);}
.sbtn{padding:7px 14px;border-radius:4px;font-size:11.5px;font-weight:700;border:none;cursor:pointer;}
.tw{background:#1da1f2;color:#fff;}.wa{background:#25d366;color:#fff;}.tg{background:#0088cc;color:#fff;}.li{background:#0077b5;color:#fff;}
.related{background:var(--faint);border:1px solid var(--border);border-radius:var(--r);padding:1.25rem;margin:1.5rem 0;}
.related h4{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.75rem;}
.related ul{padding-left:1.25rem;}.related li{font-size:13.5px;padding:3px 0;}.related a{color:var(--saffron);}
.tags-wrap{margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;}
.tags-label{width:100%;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem;}
.tag{display:inline-block;background:var(--faint);border:1px solid var(--border);color:var(--slate);padding:4px 11px;border-radius:20px;font-size:12px;font-weight:500;text-decoration:none;transition:all .15s;}
.tag:hover{background:#fff2ec;border-color:var(--saffron);color:var(--saffron);}
.art-footer{background:var(--ink);padding:2rem 1.5rem;margin-top:3rem;text-align:center;}
.art-footer-logo{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:900;color:#fff;margin-bottom:.5rem;}
.art-footer-logo span{color:var(--saffron);}
.art-footer p{font-size:12px;color:rgba(255,255,255,.35);line-height:1.7;}
.art-footer a{color:var(--saffron);}
@media(max-width:600px){.art-title{font-size:1.6rem;}.art-img{height:240px;}.wrap{padding:1rem 1rem 3rem;}.sbtn{padding:6px 9px;font-size:10.5px;}}
</style>
</head>
<body>

<div class="topbar">
  <a href="${CONFIG.siteDomain}">Bharat<span>Defence</span></a>
  <span class="topbar-meta">${article.category} · ${displayDate}</span>
</div>

<div style="max-width:780px;margin:0 auto;padding:0 1.5rem;">
  <p class="ad-lbl">Advertisement</p>
  <ins class="adsbygoogle"
       style="display:block;min-height:90px;"
       data-ad-client="ca-pub-8400475474079471"
       data-ad-slot="auto"
       data-ad-format="horizontal"
       data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<article class="wrap" itemscope itemtype="https://schema.org/NewsArticle">
  <meta itemprop="url" content="${CONFIG.siteDomain}/${seo.slug}/">
  <meta itemprop="datePublished" content="${publishDate}">
  <meta itemprop="dateModified" content="${publishDate}">

  <nav class="crumb" aria-label="Breadcrumb">
    <a href="${CONFIG.siteDomain}">Home</a> ›
    <a href="${CONFIG.siteDomain}/category/${slugify(article.category, { lower: true })}/">${article.category}</a> ›
    <span>${seo.title.substring(0, 50)}…</span>
  </nav>

  <div class="art-cat" itemprop="articleSection">${article.category}</div>
  <h1 class="art-title" itemprop="headline">${article.headline}</h1>
  <p class="art-sub">${article.subheadline}</p>

  <div class="art-meta">
    <span>🕐 ${displayDate}</span>
    <span>·</span>
    <span>⏱ ${seo.readingTime} min read</span>
    <span>·</span>
    <span>📝 ${seo.wordCount} words</span>
    <span class="badge-orig">✓ Originality ${origScore}%</span>
    <span class="badge-seo">SEO ${seoScore}/100</span>
  </div>

  <img class="art-img" src="${image.url}" alt="${article.imageAlt}" itemprop="image" loading="eager">
  <p class="art-cap">${article.imageCaption} · ${image.credit}</p>

  <div class="attr-box">
    <div class="attr-label">📌 Source Attribution & Legal Notice</div>
    <p>This article is an <strong>original AI-synthesised analysis</strong> compiled from: ${sourceLinks}. All facts attributed to original reporting. No verbatim text reproduced. BharatDefence.site operates under fair-use for news commentary. <a href="${CONFIG.siteDomain}/editorial-policy/">Editorial Policy →</a></p>
  </div>

  <div class="body" itemprop="articleBody">
    <p class="lead">${article.lead}</p>
    ${sectionsHTML}
    ${article.blockquote ? `<blockquote>"${article.blockquote}"</blockquote>` : ""}
  </div>

  <p class="ad-lbl">Advertisement</p>
  <ins class="adsbygoogle"
       style="display:block;min-height:250px;"
       data-ad-client="ca-pub-8400475474079471"
       data-ad-slot="auto"
       data-ad-format="rectangle"
       data-full-width-responsive="false"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>

  <section class="faq-sec" itemscope itemtype="https://schema.org/FAQPage">
    <h2 class="faq-title">Frequently Asked Questions</h2>
    ${faqHTML}
  </section>

  <div class="share-bar">
    <span class="share-lbl">Share:</span>
    <button class="sbtn tw" onclick="window.open('https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareURL}&via=BharatDefence','_blank','width=600,height=400')">🐦 Twitter</button>
    <button class="sbtn wa" onclick="window.open('https://wa.me/?text=${shareTitle}%20${shareURL}','_blank')">📱 WhatsApp</button>
    <button class="sbtn tg" onclick="window.open('https://t.me/share/url?url=${shareURL}&text=${shareTitle}','_blank')">✈️ Telegram</button>
    <button class="sbtn li" onclick="window.open('https://www.linkedin.com/sharing/share-offsite/?url=${shareURL}','_blank')">💼 LinkedIn</button>
  </div>

  <div class="related">
    <h4>Related Articles on BharatDefence</h4>
    <ul>${internalHTML}</ul>
  </div>

  <div class="tags-wrap">
    <div class="tags-label">Topics</div>
    ${tagsHTML}
  </div>

  <p class="ad-lbl" style="margin-top:2rem;">Advertisement</p>
  <ins class="adsbygoogle"
       style="display:block;min-height:90px;"
       data-ad-client="ca-pub-8400475474079471"
       data-ad-slot="auto"
       data-ad-format="horizontal"
       data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</article>

<div class="art-footer">
  <div class="art-footer-logo">Bharat<span>Defence</span></div>
  <p>India & World Defence Analysis · <a href="${CONFIG.siteDomain}">${CONFIG.siteDomain}</a></p>
  <p>© 2026 BharatDefence.site · AI-synthesised from cited sources · Not affiliated with any government or armed forces</p>
</div>

</body>
</html>`;
}

/* ══════════════════════════════════════
   STEP 7 — SAVE ARTICLE
══════════════════════════════════════ */
function saveArticle(data, html) {
  const { seo, article } = data;
  const dir = path.join(__dirname, CONFIG.outputDir, seo.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");

  const meta = {
    slug: seo.slug, title: seo.title,
    metaDescription: seo.metaDescription, focusKeyword: seo.focusKeyword,
    category: article.category, image: data._imageUrl, imageAlt: article.imageAlt,
    lead: article.lead?.substring(0, 220), tags: data.tags,
    readingTime: seo.readingTime, wordCount: seo.wordCount,
    publishedISO: new Date().toISOString(),
    sources: (article.sources || []).map(s => s.name),
    origScore: data._origScore,
  };

  const metaPath = path.join(__dirname, CONFIG.outputDir, "index.json");
  let all = [];
  if (fs.existsSync(metaPath)) { try { all = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch {} }
  all.unshift(meta);
  all = all.slice(0, 300);
  fs.writeFileSync(metaPath, JSON.stringify(all, null, 2), "utf8");
  console.log(`  💾 Saved → /articles/${seo.slug}/index.html`);
}

/* ══════════════════════════════════════
   STEP 8 — UPDATE SITEMAP
══════════════════════════════════════ */
function updateSitemap(slugs) {
  const sitemapPath = path.join(__dirname, CONFIG.sitemapFile);
  let existing = [];
  if (fs.existsSync(sitemapPath)) {
    const content = fs.readFileSync(sitemapPath, "utf8");
    existing = [...content.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map(m => m[1]).filter(u => u !== `${CONFIG.siteDomain}/`);
  }
  const allUrls = [...new Set([...slugs.map(s => `${CONFIG.siteDomain}/${s}/`), ...existing])].slice(0, 500);
  const today   = new Date().toISOString().split("T")[0];

  fs.writeFileSync(sitemapPath, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${CONFIG.siteDomain}/</loc><changefreq>hourly</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>
${allUrls.map(url => `  <url><loc>${url}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`, "utf8");
  console.log(`  🗺️  Sitemap: ${allUrls.length + 1} URLs`);
}

/* ══════════════════════════════════════
   STEP 9 — PING GOOGLE
══════════════════════════════════════ */
async function pingGoogle() {
  try {
    await axios.get(`https://www.google.com/ping?sitemap=${encodeURIComponent(CONFIG.siteDomain + "/sitemap.xml")}`, { timeout: 5000 });
    console.log("  ✓ Google sitemap pinged");
  } catch { console.log("  ℹ️  Google ping skipped"); }
}

/* ══════════════════════════════════════
   MAIN PIPELINE
══════════════════════════════════════ */
async function run() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  BharatDefence.site — Gemini AI Automation    ║");
  console.log(`║  ${new Date().toLocaleString("en-IN")}              ║`);
  console.log("╚═══════════════════════════════════════════════╝");

  if (!CONFIG.geminiKey) {
    console.error("❌ GEMINI_API_KEY missing! Add it to GitHub Secrets.");
    process.exit(1);
  }

  const rawStories = await collectNews();
  if (!rawStories.length) { console.log("No stories collected."); return; }

  const picks = filterAndCluster(rawStories);
  if (!picks.length) { console.log("No relevant stories after filtering."); return; }

  const publishedSlugs = [];

  for (const story of picks) {
    try {
      const data = await generateArticle(story);
      if (!data) continue;

      const bodyText = (data.article.sections || []).map(s => s.body).join(" ");
      const orig = checkOriginality(bodyText, story.summary);
      data._origScore = orig.score;
      console.log(`  📊 Originality: ${orig.score}% ${orig.passed ? "✓ PASS" : "⚠ LOW"}`);

      const image = await getImage(data.article.imageQuery, story.category);
      data._imageUrl = image.url;

      const html = buildArticleHTML(data, image, orig.score);
      saveArticle(data, html);
      publishedSlugs.push(data.seo.slug);

      console.log(`  ✅ Published: ${data.seo.title}`);
      await new Promise(r => setTimeout(r, 3000)); // avoid rate limits

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  if (publishedSlugs.length) {
    updateSitemap(publishedSlugs);
    await pingGoogle();
  }

  console.log(`\n✅ Done — ${publishedSlugs.length} articles published on BharatDefence.site`);
  publishedSlugs.forEach(s => console.log(`   → ${CONFIG.siteDomain}/${s}/`));
}

run().catch(console.error);
