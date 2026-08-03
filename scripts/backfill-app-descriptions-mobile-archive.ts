import { normalizeWebsiteDescription } from "../src/appWebsiteDescription.ts";
import { closePool, query } from "../src/db.ts";

type ArchivedDescription = {
  id: number;
  description: string;
  sourceUrl?: string;
};

const descriptions: ArchivedDescription[] = [
  { id: 1625044, description: "Agora was a social audio app for joining live conversations, discovering communities, and talking with people around shared interests." },
  { id: 865042, description: "Alan Mind, formerly Jour, is a self-care journal offering guided reflection, mindfulness exercises, and daily practices for emotional wellbeing." },
  { id: 1187872, description: "Anything is an AI app builder that turns natural-language ideas into functional mobile and web products without traditional coding." },
  { id: 729845, description: "The App Store helps Apple device users discover, purchase, download, update, and manage applications and games." },
  { id: 488444, description: "Apple COVID-19 provided symptom screening guidance, exposure information, and public-health recommendations developed with health authorities." },
  { id: 605605, description: "Arc Sidebar Sync was a mobile companion for accessing spaces, tabs, and browsing context from the Arc desktop browser." },
  { id: 333629, description: "Artifact was an AI-personalized news reader for discovering articles, following interests, summarizing stories, and discussing current events." },
  { id: 779266, description: "Beat Passenger was a ride-hailing app for requesting local trips, tracking drivers, and paying for transportation." },
  { id: 1536553, description: "Beep was a lightweight messenger for private conversations and staying connected with friends from a mobile device." },
  { id: 843228, description: "Birchbox combined beauty discovery, personalized subscription boxes, product recommendations, and shopping for cosmetics and grooming products." },
  { id: 710153, description: "Bloom is a guided self-therapy and journaling app using cognitive behavioral exercises, reflection, and mindfulness to support emotional wellbeing." },
  { id: 618087, description: "Bloomberg delivers business and financial news, market data, portfolio tracking, alerts, and analysis for investors and professionals." },
  { id: 802847, description: "Bonobos offered mobile shopping for the brand's menswear, including clothing discovery, product details, purchasing, and order management." },
  { id: 715187, description: "The Burberry app offered luxury fashion discovery, editorial content, personalized shopping, product purchasing, and access to brand experiences." },
  { id: 612802, description: "Byte was a short-form looping video network for creating clips, discovering creators, and participating in interest-based communities." },
  { id: 1647521, description: "Clover was a digital notebook combining notes, tasks, whiteboards, calendars, and daily planning in one synchronized workspace.", sourceUrl: "https://gigazine.net/gsc_news/en/20220116-clover-review/" },
  { id: 445422, description: "Cocoon was a private social space for families to share photos, messages, locations, and everyday updates with trusted relatives." },
  { id: 1342746, description: "Cornershop was an on-demand grocery marketplace for ordering products from local stores and receiving them through personal shoppers." },
  { id: 250072, description: "CREME is a cooking app offering chef-led recipes, step-by-step video guidance, meal inspiration, and tools for planning memorable meals." },
  { id: 1155396, description: "Crunchbase provides company, funding, investor, acquisition, and industry data for researching private and public businesses." },
  { id: 560558, description: "Dharma was a mobile data-collection platform for creating forms, gathering field research, and managing structured project information." },
  { id: 1202972, description: "Dot was a personal AI companion that learned from conversations, offered personalized guidance, and created an evolving journal of life events.", sourceUrl: "https://apps.apple.com/us/app/dot-living-history/id6450016041" },
  { id: 695916, description: "Drop was a rewards app for earning points and cash back from linked purchases, brands, games, surveys, and shopping offers." },
  { id: 310223, description: "Duolingo Math taught foundational mathematics through short interactive lessons, visual exercises, practice challenges, and progress-based learning." },
  { id: 807729, description: "Elbi was a charitable giving app that made supporting nonprofit campaigns simple through small donations and creative acts of kindness." },
  { id: 309627, description: "Entale was an interactive podcast player that synchronized audio with images, links, maps, and other visual storytelling elements." },
  { id: 1546115, description: "Facebook Local combined nearby events, places, recommendations, calendars, and activity discovery using information from Facebook communities." },
  { id: 1354996, description: "Fancy was a social shopping marketplace for discovering distinctive products, saving collections, following tastemakers, and purchasing items." },
  { id: 1218412, description: "Gas was a social polling app where students sent anonymous positive compliments and learned what friends appreciated about them." },
  { id: 739828, description: "Gawq was a news reader designed to compare coverage, reveal source context, and reduce bias across stories and publications." },
  { id: 333738, description: "Genie was an AI assistant for asking questions, generating text, brainstorming ideas, and completing everyday writing tasks." },
  { id: 333755, description: "Google Pay supported contactless payments, peer transfers, loyalty cards, offers, transaction management, and everyday financial activity." },
  { id: 333756, description: "Google Podcasts was a podcast player for discovering shows, subscribing, downloading episodes, and synchronizing listening across devices." },
  { id: 333781, description: "Houseparty was a face-to-face social network for spontaneous group video calls, friend notifications, and games during live conversations." },
  { id: 265712, description: "HQ Trivia was a live mobile game show where players answered timed questions to compete for shared cash prizes." },
  { id: 339279, description: "Hush was a beauty marketplace offering affordable cosmetics discovery, curated trends, product shopping, and direct delivery." },
  { id: 333786, description: "Hutch was a virtual interior-design app for visualizing furniture and decor inside photographed rooms before purchasing products." },
  { id: 780565, description: "IGTV was Instagram's long-form video app for watching vertical programs, following creators, and publishing extended mobile videos." },
  { id: 340699, description: "IKEA Place used augmented reality to preview accurately scaled IKEA furniture and home products inside a real room." },
  { id: 1034278, description: "informed News was a subscription news app offering curated reporting and analysis from international publishers in one reading experience." },
  { id: 1114564, description: "Instamotor was a marketplace for discovering, listing, verifying, and purchasing used vehicles directly from local sellers." },
  { id: 333794, description: "IRL was a social calendar and group messaging app for discovering events, planning activities, and coordinating with friends." },
  { id: 546103, description: "Jet was an ecommerce marketplace for shopping household goods, groceries, electronics, apparel, and other products with dynamic savings." },
  { id: 333799, description: "Jumprope was a platform for creating and sharing step-by-step instructional videos about cooking, beauty, fitness, crafts, and other skills." },
  { id: 236003, description: "Klima helped people estimate their carbon footprint, fund verified climate projects, and adopt lower-impact personal habits." },
  { id: 1185103, description: "LIVESTRONG MyQuit Coach helped people create personalized plans, track progress, manage cravings, and build motivation to stop smoking." },
  { id: 333827, description: "Locals is a community and events app for finding nearby activities, meeting people, joining groups, and organizing real-world gatherings." },
  { id: 879497, description: "Magnolia Market offered shopping and inspiration for home decor, furniture, lifestyle goods, seasonal collections, and Magnolia brand products." },
  { id: 333836, description: "Mammoth was a Mastodon client for browsing timelines, discovering communities, publishing posts, and managing federated social conversations." },
  { id: 333844, description: "Meituan Takeaway lets customers order restaurant meals, groceries, drinks, and other local goods for on-demand delivery." },
  { id: 758174, description: "Mercari is a mobile marketplace for listing, buying, selling, shipping, and paying for secondhand and new consumer goods." },
  { id: 333852, description: "Minna Bank is a mobile-first Japanese bank for opening accounts, managing money, making transfers, and using debit services." },
  { id: 556995, description: "Mint was a personal finance app for connecting accounts, tracking spending, creating budgets, monitoring bills, and viewing net worth." },
  { id: 640351, description: "Missguided offered mobile shopping for women's fashion, new arrivals, promotions, wish lists, purchasing, and order tracking." },
  { id: 704025, description: "Monkey is a social video-chat app for meeting new people through short conversations and interest-based connections." },
  { id: 1607443, description: "Mucho was a recipe and grocery-planning app for discovering meals, organizing ingredients, and simplifying home cooking." },
  { id: 1038657, description: "Natural was an AI-driven interface for completing everyday tasks through conversational requests instead of navigating traditional apps.", sourceUrl: "https://apptopia.com/ios/app/1521375720/about" },
  { id: 1470166, description: "Navigator was a meeting assistant that helped teams prepare agendas, guide conversations, capture decisions, and follow up on commitments." },
  { id: 653847, description: "Neverthink was a curated video and meme app offering continuously playing channels organized around entertainment and internet culture." },
  { id: 1399520, description: "NYT Audio brought New York Times journalism, narrated articles, podcasts, and other spoken-word reporting into one listening app." },
  { id: 333878, description: "ofo was a dockless bike-sharing app for locating nearby bicycles, unlocking rides, tracking trips, and paying from a phone." },
  { id: 229823, description: "Pacemaker is an AI-assisted DJ app for mixing music, creating transitions, building playlists, and performing sets from a mobile device." },
  { id: 715999, description: "Periscope was a live-video broadcasting network for streaming events, watching creators, commenting, and interacting with viewers in real time." },
  { id: 1383726, description: "Play is a native iOS design tool for creating interactive app interfaces, testing gestures, and building realistic prototypes on device." },
  { id: 702081, description: "Posts by Read.cv was a professional community feed for sharing work, ideas, links, and updates with other makers." },
  { id: 799313, description: "Powder was a gaming video platform for automatically capturing, editing, and sharing highlights from gameplay and livestreams." },
  { id: 616123, description: "Py taught programming through short interactive lessons, practice exercises, progress tracking, and courses covering popular coding languages." },
  { id: 1475176, description: "Quibi was a mobile streaming service offering professionally produced short-form shows designed to be watched in brief episodes." },
  { id: 1284649, description: "Rewind was a personalized AI assistant that captured searchable context and helped users recall, summarize, and work with past information." },
  { id: 812993, description: "Riveo is a mobile video editor for creating motion effects, transitions, distortions, loops, and stylized visual compositions." },
  { id: 489264, description: "Shift was an online used-car marketplace for browsing inspected vehicles, arranging test drives, financing purchases, and selling cars." },
  { id: 781193, description: "Simple Contacts provided mobile eye exams and contact-lens prescription renewal through guided vision tests reviewed by clinicians." },
  { id: 556011, description: "SIX was a social discovery app for meeting people through mutual connections and expanding trusted personal networks." },
  { id: 1595007, description: "Sonar was a social audio app for creating virtual spaces, talking with friends, and exploring community-built worlds." },
  { id: 333971, description: "Spring was a mobile fashion marketplace for discovering brands, following curated shops, and purchasing apparel and accessories." },
  { id: 1296867, description: "TechCrunch delivers technology and startup news, product coverage, funding reports, company analysis, and industry event updates." },
  { id: 1716963, description: "Threads was a workplace communication app for organizing focused team discussions, sharing updates, and reducing fragmented chat." },
  { id: 649067, description: "Threads is Instagram's text-based social app for publishing posts, joining public conversations, and following people and interests." },
  { id: 1619492, description: "Threads is Instagram's text-based social app for publishing posts, joining public conversations, and following people and interests." },
  { id: 694222, description: "Tribe was a social party-game app for playing casual multiplayer games and staying connected with friends." },
  { id: 1624964, description: "Vevo was a music-video app for watching official releases, discovering artists, building playlists, and following personalized recommendations." },
  { id: 877092, description: "WAV was a music community for watching performances, discovering independent artists, livestreaming events, and interacting with creators." },
  { id: 1543636, description: "Waze Carpool matched commuters traveling similar routes so riders and drivers could share trips and divide transportation costs." },
  { id: 438453, description: "Wealthsimple Invest provides automated investing, managed portfolios, account tracking, recurring contributions, and long-term financial planning." },
  { id: 669292, description: "Zenly was a social location app for seeing close friends on a live map, messaging, and sharing real-world activity." },
  { id: 1473328, description: "Zesty is a local food discovery app for finding nearby dishes, restaurants, recommendations, and dining experiences." },
  { id: 1660586, description: "Zing is an international money app for holding currencies, exchanging funds, making payments, and sending transfers across countries." },
];

const apply = process.argv.includes("--apply");
const seen = new Set<number>();
const invalid = descriptions.flatMap((entry) => {
  if (seen.has(entry.id)) return [{ id: entry.id, reason: "duplicate id" }];
  seen.add(entry.id);
  if (normalizeWebsiteDescription(entry.description) !== entry.description) {
    return [{ id: entry.id, reason: "description failed normalization" }];
  }
  if (entry.sourceUrl) {
    try {
      new URL(entry.sourceUrl);
    } catch {
      return [{ id: entry.id, reason: "invalid source URL" }];
    }
  }
  return [];
});
if (invalid.length > 0) throw new Error(`Invalid archive descriptions: ${JSON.stringify(invalid)}`);

let matched = 0;
let applied = 0;
const skipped: number[] = [];
try {
  for (const entry of descriptions) {
    const result = await query<{ id: number }>(
      `UPDATE apps
       SET description = CASE WHEN $1::boolean THEN $2 ELSE description END,
           description_source = CASE WHEN $1::boolean THEN $3 ELSE description_source END,
           description_source_url = CASE WHEN $1::boolean THEN COALESCE($4, website_url) ELSE description_source_url END,
           description_updated_at = CASE WHEN $1::boolean THEN now() ELSE description_updated_at END
       WHERE id = $5
         AND COALESCE(LENGTH(BTRIM(description)), 0) = 0
       RETURNING id`,
      [apply, entry.description, "mobile-archive-curated", entry.sourceUrl ?? null, entry.id],
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
