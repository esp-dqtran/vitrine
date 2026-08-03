import { normalizeWebsiteDescription } from "../src/appWebsiteDescription.ts";
import { closePool, query } from "../src/db.ts";

type SearchDescription = {
  id: number;
  description: string;
  sourceUrl: string;
  sourceKind?: "official" | "reputable";
};

const descriptions: SearchDescription[] = [
  { id: 11845, description: "Fey combines portfolio tracking, market data, research, news, charts, and earnings insights in a streamlined investment workspace.", sourceUrl: "https://www.fey.com/?s=09" },
  { id: 17978, description: "LinkedIn is a professional network for finding opportunities, building work relationships, sharing expertise, and learning career skills.", sourceUrl: "https://www.linkedin.com/help/linkedin/answer/a548441/" },
  { id: 22997, description: "Visual Electric is a generative design workspace for creating, editing, organizing, and collaborating on AI-powered images and videos.", sourceUrl: "https://visualelectric.com/whats-new" },
  { id: 33382, description: "Bento lets creators collect videos, podcasts, newsletters, photos, products, and other links on one customizable personal page.", sourceUrl: "https://landing.bento.me/" },
  { id: 36755, description: "Grok is xAI's assistant for chatting, searching, reasoning, creating media, analyzing files, and working with connected tools.", sourceUrl: "https://docs.x.ai/grok/overview" },
  { id: 38443, description: "HODINKEE is a destination for watch journalism, collecting culture, horological education, and curated timepieces and accessories.", sourceUrl: "https://www.hodinkee.com/pages/our-story" },
  { id: 45414, description: "Causal is a visual financial modeling platform for building, collaborating on, and sharing interactive business plans and forecasts.", sourceUrl: "https://grove.financial/profiles/causal", sourceKind: "reputable" },
  { id: 48175, description: "Posh helps people discover events and communities while giving organizers tools to create pages, sell tickets, and manage attendees.", sourceUrl: "https://support.posh.vip/en/articles/10723772-your-guide-to-posh-app-search" },
  { id: 50241, description: "Turo is a car-sharing marketplace where guests book vehicles from local hosts and owners can build car-sharing businesses.", sourceUrl: "https://turo.com/us/en/about" },
  { id: 54958, description: "Peerlist is a professional network for technology workers to showcase verified work, discover projects, and find new opportunities.", sourceUrl: "https://peerlist.io/company/peerlist" },
  { id: 56963, description: "The IKEA app supports product discovery, personalized offers, room visualization, in-store navigation, checkout, and order tracking.", sourceUrl: "https://www.ikea.com/gb/en/ikea-app/" },
  { id: 63224, description: "Cosmos is a visual discovery app for finding inspiration, saving ideas, building collections, and sharing them with collaborators.", sourceUrl: "https://apps.apple.com/us/app/cosmos-search-discover/id1577975475" },
  { id: 66773, description: "Cycle connects customer feedback with product delivery workflows so teams can organize insights and close the feedback loop.", sourceUrl: "https://docs.cycle.app/introduction/about-cycle" },
  { id: 67920, description: "Clay is a personal relationship manager that organizes contact signals and context to help people maintain stronger connections.", sourceUrl: "https://techcrunch.com/2021/08/30/clay-debuts-a-new-tool-to-help-people-better-manage-their-business-and-personal-relationships/", sourceKind: "reputable" },
  { id: 74434, description: "Strut is an AI-assisted writing workspace that combines notes, documents, projects, focused drafting, and team collaboration.", sourceUrl: "https://strut.so/index.html" },
  { id: 75828, description: "Copilot Money brings spending, budgets, investments, subscriptions, cash flow, and net worth into one personal finance dashboard.", sourceUrl: "https://www.copilot.money/faq" },
  { id: 81865, description: "Blue Apron delivers chef-designed recipes and pre-portioned ingredients, alongside prepared meals that simplify cooking at home.", sourceUrl: "https://www.blueapron.com/cookbook" },
  { id: 87496, description: "Disney+ streams movies and shows from Disney, Pixar, Marvel, Star Wars, National Geographic, and other entertainment brands.", sourceUrl: "https://press.disneyplus.com/about" },
  { id: 88469, description: "Substack connects readers with independent writing, videos, podcasts, livestreams, chats, creators, and subscriber communities.", sourceUrl: "https://apps.apple.com/us/app/substack/id1581650857" },
  { id: 90336, description: "Microsoft Loop combines flexible canvases, portable components, and shared workspaces for teams to plan and create together.", sourceUrl: "https://support.microsoft.com/en-us/loop/get-started-with-microsoft-loop" },
  { id: 96319, description: "Hulu is a subscription streaming service for on-demand shows and films, originals, live television, sports, and news.", sourceUrl: "https://press.hulu.com/corporate/" },
  { id: 106244, description: "OpenAI Platform provides APIs and developer tools for building applications with models for text, vision, agents, and more.", sourceUrl: "https://platform.openai.com/docs/quickstart/make-your-first-api-request" },
  { id: 108478, description: "Prime Video is Amazon's streaming service for movies, series, live sports, rentals, purchases, and add-on channel subscriptions.", sourceUrl: "https://www.aboutamazon.com/news/entertainment/what-you-need-to-know-about-prime-video" },
  { id: 112603, description: "Threads was a workplace communication platform designed to organize team discussions and replace fragmented chat tools.", sourceUrl: "https://www.linkedin.com/company/threadsgroupinc", sourceKind: "reputable" },
  { id: 121130, description: "Skype was a communication app for individual and group voice calls, video calls, instant messages, and file sharing.", sourceUrl: "https://support.microsoft.com/en-us/skype/4ee90a4c-7183-439f-b6dc-dad1254dfd3f" },
  { id: 133907, description: "Medium is a publishing platform where people read thoughtful stories, follow writers, and share their own ideas with an audience.", sourceUrl: "https://help.medium.com/hc/en-us/articles/225168028-Using-Medium" },
  { id: 146691, description: "FARFETCH is a global marketplace for shopping luxury clothing, footwear, accessories, jewelry, homeware, and designer collections.", sourceUrl: "https://apps.apple.com/us/app/farfetch-shop-luxury-fashion/id906698760" },
  { id: 152479, description: "Polywork is a professional platform for presenting work, credentials, interests, and personal perspectives beyond a traditional resume.", sourceUrl: "https://join.polywork.com/" },
  { id: 153042, description: "v0 turns natural-language ideas into working web applications and interfaces using modern frontend tools and deployable code.", sourceUrl: "https://v0.dev/docs/introduction" },
  { id: 162150, description: "The Walmart app supports shopping for groceries and general merchandise with delivery, shipping, curbside pickup, and in-store tools.", sourceUrl: "https://play.google.com/store/apps/details?id=com.walmart.android&hl=en_US" },
  { id: 173317, description: "Record Club is a social music network for tracking, rating, reviewing, listing, and discussing releases with other music fans.", sourceUrl: "https://apps.apple.com/us/app/record-club/id6478712233" },
  { id: 175623, description: "DoorDash connects customers with restaurants, grocery stores, and retailers for on-demand delivery and pickup ordered online.", sourceUrl: "https://about.doordash.com/en-us/company" },
  { id: 178639, description: "7shifts helps restaurants hire, train, schedule, communicate with, pay, and retain their teams from one platform.", sourceUrl: "https://www.7shifts.com/media-kit" },
  { id: 208975, description: "OpenPhone, now Quo, is a collaborative business phone system for calls, texts, shared numbers, and team communication.", sourceUrl: "https://support.quo.com/getting-started/introduction" },
  { id: 212886, description: "The Athletic provides subscription-based, in-depth sports journalism with personalized coverage of teams, leagues, and major competitions.", sourceUrl: "https://thenewyorktimeshelpcenter.helpjuice.com/4418858416276-The-Athletic-Subscription" },
  { id: 224667, description: "Google Drive provides cloud storage and synchronization for files, with sharing and collaboration across Google Workspace applications.", sourceUrl: "https://play.google.com/store/apps/details?id=com.google.android.apps.docs&hl=en-US" },
  { id: 226532, description: "The Starbucks app supports mobile ordering, customized drinks, store payments, rewards, gift cards, and nearby store discovery.", sourceUrl: "https://apps.apple.com/us/app/starbucks/id331177714" },
  { id: 231534, description: "Pocket was a read-later service for saving articles, stories, and videos to revisit across devices, online or offline.", sourceUrl: "https://www.mozilla.org/en-US/firefox/pocket/" },
  { id: 254541, description: "Instacart lets customers order groceries and household products from nearby stores for scheduled pickup or same-day delivery.", sourceUrl: "https://apps.apple.com/us/app/instacart-grocery-delivery/id545599256" },
  { id: 258857, description: "Notion is a productivity workspace for writing, planning, organizing notes, managing projects and tasks, and working with AI.", sourceUrl: "https://apps.apple.com/us/app/notion-notes-tasks-ai/id1232780281" },
  { id: 261175, description: "Quartz is a digital business news publication covering companies, technology, markets, work, and the global economy.", sourceUrl: "https://www.axios.com/2025/04/04/quartz-sold-redbrick-go-media", sourceKind: "reputable" },
  { id: 313254, description: "Microsoft Teams brings chats, channels, meetings, calls, files, tasks, calendars, and community collaboration into one application.", sourceUrl: "https://apps.apple.com/us/app/microsoft-teams/id1113153706" },
  { id: 333644, description: "Bleacher Report delivers sports news, scores, highlights, analysis, community discussion, and personalized updates for favorite teams.", sourceUrl: "https://apps.apple.com/us/app/bleacher-report-sports-news/id418075935" },
  { id: 333685, description: "Cron, now Notion Calendar, combines fast scheduling, multiple calendars, time zones, conferencing, and links to Notion work.", sourceUrl: "https://apps.apple.com/us/app/cron-calendar/id1607562761" },
  { id: 333770, description: "HBO Max streams shows, movies, original series, live sports, and programming from HBO, Warner Bros., DC, and more.", sourceUrl: "https://apps.apple.com/us/app/hbo-max-stream-movies-tv/id1666653815" },
  { id: 333824, description: "Linktree creates one customizable link for sharing a creator's profiles, content, products, stores, and other destinations.", sourceUrl: "https://linktr.ee/s/about" },
  { id: 333887, description: "Origin combines budgeting, account aggregation, cash-flow tracking, investments, net worth, forecasts, and personalized financial guidance.", sourceUrl: "https://apps.apple.com/us/app/origin-ai-budget-and-track/id1637693312" },
  { id: 333896, description: "Peerspace is a marketplace for booking distinctive spaces by the hour for meetings, events, photo shoots, and productions.", sourceUrl: "https://support.peerspace.com/en/articles/10119094-what-is-peerspace" },
  { id: 333923, description: "Read.cv was a professional network for creating polished work profiles, showcasing portfolios, writing, and forming meaningful connections.", sourceUrl: "https://www.producthunt.com/products/cv", sourceKind: "reputable" },
  { id: 333951, description: "Shop brings brand discovery, saved products, one-tap checkout, order tracking, and a secure Shop Pay wallet into one app.", sourceUrl: "https://apps.apple.com/us/app/shop-all-your-favorite-brands/id1223471316" },
  { id: 333957, description: "Skillshare is an online learning community offering project-based classes in design, illustration, photography, video, freelancing, and other creative skills.", sourceUrl: "https://www.skillshare.com/en/about" },
  { id: 333969, description: "Spotify is an audio streaming service for discovering, managing, and enjoying music, podcasts, and audiobooks across devices.", sourceUrl: "https://newsroom.spotify.com/company-info/" },
  { id: 333993, description: "Telegram is a cloud-based messaging app for synchronized chats, groups, channels, calls, and file sharing across devices.", sourceUrl: "https://telegram.org/faq" },
  { id: 334001, description: "TikTok is a short-form video platform for creative expression, personalized discovery, entertainment, and interaction with creators.", sourceUrl: "https://newsroom.tiktok.com/musical-ly-and/?lang=en" },
  { id: 334009, description: "TravelPerk is a business travel platform for booking trips, enforcing policies, managing expenses, reporting, and supporting travelers.", sourceUrl: "https://www.travelperk.com/blog/implementing-a-modern-corporate-travel-solution/" },
  { id: 334020, description: "Uber operates technology platforms that connect riders with transportation providers and customers with restaurants, groceries, and delivery services.", sourceUrl: "https://www.uber.com/us/en/about/uber-offerings/" },
  { id: 334026, description: "Uniswap Wallet is a self-custody crypto app for buying, swapping, sending, receiving, tracking tokens, and exploring onchain applications.", sourceUrl: "https://apps.apple.com/us/app/uniswap-wallet/id6443944476" },
  { id: 334029, description: "Untitled helps musicians listen to, organize, edit, and privately share work-in-progress tracks across mobile and web devices.", sourceUrl: "https://apps.apple.com/us/app/untitled/id6445854828" },
  { id: 334034, description: "Uvodo is an ecommerce and payments platform for launching an online store, managing products, and accepting customer payments.", sourceUrl: "https://www.producthunt.com/products/uvodo", sourceKind: "reputable" },
  { id: 334197, description: "HelloFresh delivers chef-crafted recipes and ingredients while its app supports meal selection, delivery preferences, and guided cooking.", sourceUrl: "https://apps.apple.com/us/app/hellofresh-meal-kit-delivery/id970107419" },
  { id: 339836, description: "YNAB is a budgeting app for planning spending, organizing accounts, paying down debt, tracking goals, and managing money together.", sourceUrl: "https://apps.apple.com/us/app/ynab/id1010865877" },
  { id: 457240, description: "Charma was a performance management tool that guided managers and teams through workplace relationships, feedback, and recurring conversations.", sourceUrl: "https://marketplace.atlassian.com/apps/1226534/charma", sourceKind: "reputable" },
  { id: 528436, description: "Threads was an all-in-one workplace communication platform that organized team discussions for makers and replaced fragmented chat tools.", sourceUrl: "https://www.linkedin.com/company/threadsgroupinc", sourceKind: "reputable" },
  { id: 555974, description: "WeTransfer lets people send and receive large files, monitor transfers, and share original-quality photos and videos across devices.", sourceUrl: "https://apps.apple.com/us/app/wetransfer-transfer-files/id1569379048" },
  { id: 560652, description: "Hims provides online men's healthcare for concerns including hair loss, sexual health, weight management, mental health, and skincare.", sourceUrl: "https://apps.apple.com/us/app/hims/id1455690574" },
  { id: 562534, description: "Care.com connects families seeking child, senior, pet, and household care with caregivers and related support services.", sourceUrl: "https://www.care.com/about/" },
  { id: 607951, description: "Google Gemini is an AI assistant for research, writing, brainstorming, file analysis, live conversation, and connected Google applications.", sourceUrl: "https://apps.apple.com/us/app/google-gemini/id6477489729" },
  { id: 632157, description: "GoDaddy provides domains, web hosting, website building, business email, security, and marketing tools for establishing an online presence.", sourceUrl: "https://www.godaddy.com/en/domains" },
  { id: 646787, description: "ClickUp combines project management, communication, documents, scheduling, time tracking, dashboards, automation, and AI agents in one workspace.", sourceUrl: "https://apps.apple.com/us/app/clickup-tasks-chat-docs-ai/id1535098836" },
  { id: 650297, description: "Oku is a social book companion for tracking reading, building a library, discovering books, reviewing titles, and creating collections.", sourceUrl: "https://oku.so/" },
  { id: 651295, description: "Quicken brings personal and business accounts, spending, budgets, investments, cash flow, invoices, and financial planning into one app.", sourceUrl: "https://apps.apple.com/us/app/quicken-intelligent-money/id1449777194" },
  { id: 659567, description: "Coursera offers flexible online courses, projects, professional certificates, specializations, and university degrees for career development.", sourceUrl: "https://apps.apple.com/us/app/coursera-grow-your-career/id736535961" },
  { id: 670847, description: "Fiverr is a marketplace connecting businesses and entrepreneurs with freelancers offering digital, creative, technical, and professional services.", sourceUrl: "https://play.google.com/store/apps/details?id=com.fiverr.fiverr" },
  { id: 690266, description: "Klook lets travelers discover and book tours, attractions, activities, transportation, accommodation, and other destination experiences.", sourceUrl: "https://www.klook.com/" },
  { id: 692890, description: "Eventbrite helps people discover, book, and share local events while giving organizers tools to publish and manage experiences.", sourceUrl: "https://apps.apple.com/us/app/eventbrite/id487922291" },
  { id: 719965, description: "Shopify lets entrepreneurs create and manage ecommerce businesses, products, orders, inventory, marketing, payments, and in-person sales.", sourceUrl: "https://play.google.com/store/apps/details?id=com.shopify.mobile" },
  { id: 765297, description: "YouTube lets people watch, discover, follow, upload, livestream, and discuss videos from creators around the world.", sourceUrl: "https://apps.apple.com/us/app/youtube/id544007664" },
  { id: 770919, description: "Perplexity is an AI-powered search and answer engine that researches questions and returns direct responses with cited sources.", sourceUrl: "https://www.perplexity.ai/help-center/en/articles/10352155-what-is-perplexity" },
  { id: 790362, description: "Hers provides online women's healthcare with personalized treatment and ongoing support for wellness, mental health, skin, and other needs.", sourceUrl: "https://www.forhers.com/" },
  { id: 821201, description: "Assembly is an employee recognition and rewards platform that helps teams celebrate achievements, strengthen culture, and stay connected.", sourceUrl: "https://joinassembly.com/" },
  { id: 868138, description: "The Wall Street Journal app provides business, finance, politics, technology, economy, and market reporting with real-time updates and analysis.", sourceUrl: "https://apps.apple.com/us/app/the-wall-street-journal-news/id364387007" },
  { id: 878200, description: "Zillow supports buying and renting homes with property listings, personalized searches, saved collections, affordability tools, and agent connections.", sourceUrl: "https://apps.apple.com/us/app/zillow-real-estate-rentals/id310738695" },
  { id: 885187, description: "Reddit is a social platform where people join interest-based communities, share posts, ask questions, and participate in discussions.", sourceUrl: "https://apps.apple.com/us/app/reddit/id1064216828" },
  { id: 1006980, description: "ManyChat automates marketing conversations across social messaging channels to capture leads, nurture relationships, and support sales funnels.", sourceUrl: "https://manychat.com/" },
  { id: 1092571, description: "WhatsApp is a cross-device messaging and calling app for private chats, groups, voice calls, video calls, and media sharing.", sourceUrl: "https://play.google.com/store/apps/details?id=com.whatsapp&hl=en-US" },
  { id: 1222902, description: "Instagram is a social platform for sharing photos, stories, messages, and short videos while discovering creators, interests, and businesses.", sourceUrl: "https://apps.apple.com/us/app/instagram/id389801252" },
  { id: 1253592, description: "Weavy combines AI models, professional editing tools, compositing, and reusable node-based workflows for creative production teams.", sourceUrl: "https://www.weavy.ai/" },
  { id: 1274885, description: "Height was an autonomous project management workspace that used AI to update tasks, triage bugs, maintain specifications, and organize backlogs.", sourceUrl: "https://www.linkedin.com/company/heightapp", sourceKind: "reputable" },
  { id: 1402170, description: "Monarch combines accounts, transactions, budgets, investments, bills, net worth, goals, and household collaboration in one personal finance app.", sourceUrl: "https://apps.apple.com/us/app/monarch-budget-track-money/id1459319842" },
  { id: 1429441, description: "The lululemon app supports browsing athletic apparel, checking store inventory, saving favorites, purchasing products, and finding local events.", sourceUrl: "https://apps.apple.com/us/app/lululemon/id920098546" },
  { id: 1468979, description: "Bard was Google's conversational AI experiment for exploring information, simplifying complex topics, brainstorming ideas, and supporting creative work.", sourceUrl: "https://blog.google/innovation-and-ai/technology/ai/bard-google-ai-search-updates/" },
  { id: 1493071, description: "Frame is an AI-powered company workspace that connects business applications and enables unified search across organizational data.", sourceUrl: "https://www.frame.so/features/cross-apps-search" },
  { id: 1561086, description: "Cloaked protects personal data by generating unique email addresses, phone numbers, passwords, and other identities for online accounts.", sourceUrl: "https://www.cloaked.com/about" },
];

const apply = process.argv.includes("--apply");
const seen = new Set<number>();
const invalid = descriptions.flatMap((entry) => {
  const normalized = normalizeWebsiteDescription(entry.description);
  if (seen.has(entry.id)) return [{ id: entry.id, reason: "duplicate id" }];
  seen.add(entry.id);
  if (normalized !== entry.description) return [{ id: entry.id, reason: "description failed normalization" }];
  try {
    new URL(entry.sourceUrl);
  } catch {
    return [{ id: entry.id, reason: "invalid source URL" }];
  }
  return [];
});

if (invalid.length > 0) {
  throw new Error(`Invalid curated descriptions: ${JSON.stringify(invalid)}`);
}

let matched = 0;
let applied = 0;
const skipped: number[] = [];

try {
  for (const entry of descriptions) {
    const result = await query<{ id: number }>(
      `UPDATE apps
       SET description = CASE WHEN $1::boolean THEN $2 ELSE description END,
           description_source = CASE WHEN $1::boolean THEN $3 ELSE description_source END,
           description_source_url = CASE WHEN $1::boolean THEN $4 ELSE description_source_url END,
           description_updated_at = CASE WHEN $1::boolean THEN now() ELSE description_updated_at END
       WHERE id = $5
         AND COALESCE(LENGTH(BTRIM(description)), 0) = 0
       RETURNING id`,
      [
        apply,
        entry.description,
        `web-search-curated-${entry.sourceKind ?? "official"}`,
        entry.sourceUrl,
        entry.id,
      ],
    );
    if (result.rowCount === 1) {
      matched += 1;
      if (apply) applied += 1;
    } else {
      skipped.push(entry.id);
    }
  }
} finally {
  await closePool();
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  curated: descriptions.length,
  matched,
  applied,
  skipped,
}, null, 2));
