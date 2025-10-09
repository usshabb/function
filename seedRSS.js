const mongoose = require('mongoose');
require('dotenv').config();

const RSSSource = require('./models/RSSSource');

const rssSources = [
    // Thinking
    { name: "The Decision Lab", url: "https://thedecisionlab.com/feed/", category: "Thinking" },
    { name: "Ness Labs", url: "https://nesslabs.com/feed", category: "Thinking" },
    { name: "Farnam Street", url: "https://fs.blog/feed/", category: "Thinking" },
    { name: "The Sunday Wisdom", url: "https://coffeeandjunk.substack.com/feed", category: "Thinking" },
    { name: "Commonplace - The Commoncog Blog", url: "https://commoncog.com/blog/rss/", category: "Thinking" },
    { name: "Scott H Young", url: "https://feeds.feedburner.com/scotthyoung/HAHx", category: "Thinking" },
    { name: "Big Think", url: "https://feeds.feedburner.com/bigthink/main", category: "Thinking" },
    
    // Startup
    { name: "Steve Blank", url: "http://steveblank.com/feed/", category: "Startup" },
    { name: "George Hotz", url: "https://geohot.github.io/blog/feed.xml", category: "Startup" },
    { name: "Hacker News", url: "http://news.ycombinator.com/rss", category: "Startup" },
    { name: "Guy Kawasaki", url: "http://guykawasaki.com/feed/", category: "Startup" },
    { name: "Benedict Evans", url: "http://ben-evans.com/benedictevans?format=rss", category: "Startup" },
    { name: "First Round Review", url: "http://firstround.com/review/feed.xml", category: "Startup" },
    { name: "Sam Altman", url: "http://blog.samaltman.com/posts.atom", category: "Startup" },
    { name: "Andrew Chen", url: "http://andrewchen.co/feed/", category: "Startup" },
    { name: "Both Sides of the Table", url: "https://bothsidesofthetable.com/feed", category: "Startup" },
    { name: "TechCrunch Startups", url: "https://techcrunch.com/startups/feed/", category: "Startup" },
    { name: "OnStartups", url: "http://feed.onstartups.com/onstartups", category: "Startup" },
    { name: "The Black Box of PM", url: "https://medium.com/feed/the-black-box-of-product-management", category: "Startup" },
    { name: "Irrational Exuberance", url: "https://lethain.com/feeds/", category: "Startup" },
    
    // Tech News
    { name: "Fast Company", url: "http://www.fastcodesign.com/rss.xml", category: "Tech News" },
    { name: "Forbes Entrepreneurs", url: "http://www.forbes.com/entrepreneurs/index.xml", category: "Tech News" },
    { name: "SlashGear", url: "http://feeds.slashgear.com/slashgear", category: "Tech News" },
    { name: "VentureBeat", url: "http://venturebeat.com/feed/", category: "Tech News" },
    { name: "The Verge", url: "http://www.theverge.com/rss/full.xml", category: "Tech News" },
    { name: "Engadget", url: "http://www.engadget.com/rss-full.xml", category: "Tech News" },
    { name: "Tech in Asia", url: "https://feeds2.feedburner.com/PennOlson", category: "Tech News" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech News" },
    { name: "Forbes Leadership", url: "https://www.forbes.com/leadership/feed/", category: "Tech News" },
    
    // Products & Ideas
    { name: "Product Hunt", url: "http://www.producthunt.com/feed", category: "Products & Ideas" },
    { name: "Hacker News: Show HN", url: "http://hnrss.org/show", category: "Products & Ideas" },
    { name: "Hacker News: Launches", url: "https://hnrss.org/launches", category: "Products & Ideas" },
    { name: "Sachin Rekhi's Blog", url: "http://feeds.feedburner.com/sachinrekhiblog", category: "Products & Ideas" },
    
    // Engineering
    { name: "The Pragmatic Engineer", url: "https://blog.pragmaticengineer.com/rss/", category: "Engineering" },
    { name: "Airtable Engineering", url: "https://medium.com/feed/airtable-eng", category: "Engineering" },
    { name: "Medium Engineering", url: "https://medium.com/feed/medium-eng", category: "Engineering" },
    { name: "PayPal Tech Blog", url: "https://medium.com/feed/paypal-engineering", category: "Engineering" },
    { name: "Pinterest Engineering", url: "https://medium.com/feed/pinterest-engineering", category: "Engineering" },
    { name: "Grab Tech", url: "http://engineering.grab.com/feed.xml", category: "Engineering" },
    { name: "Slack Engineering", url: "https://slack.engineering/feed", category: "Engineering" },
    { name: "GitHub Engineering", url: "http://githubengineering.com/atom.xml", category: "Engineering" },
    { name: "Atlassian Developer", url: "https://developer.atlassian.com/blog/feed.xml", category: "Engineering" },
    { name: "Facebook Engineering", url: "https://code.facebook.com/posts/rss", category: "Engineering" },
    { name: "Grokking Newsletter", url: "http://newsletter.grokking.org/?format=rss", category: "Engineering" },
    { name: "eBay Tech Blog", url: "http://www.ebaytechblog.com/feed/", category: "Engineering" },
    { name: "Spotify Engineering", url: "https://engineering.atspotify.com/feed/", category: "Engineering" },
    { name: "Twitter Engineering", url: "https://blog.twitter.com/engineering/en_us/blog.rss", category: "Engineering" },
    { name: "Stripe Blog", url: "https://stripe.com/blog/feed.rss", category: "Engineering" },
    { name: "Instagram Engineering", url: "https://instagram-engineering.com/feed", category: "Engineering" },
    { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", category: "Engineering" },
    { name: "Asana Engineering", url: "https://blog.asana.com/category/eng/feed/", category: "Engineering" },
    { name: "Canva Engineering", url: "https://engineering.canva.com/rss", category: "Engineering" },
    { name: "Airbnb Tech Blog", url: "https://medium.com/feed/airbnb-engineering", category: "Engineering" },
    { name: "Dropbox Tech", url: "https://dropbox.tech/feed", category: "Engineering" },
    { name: "WePay Engineering", url: "https://wecode.wepay.com/feed.xml", category: "Engineering" },
    { name: "Web Browser Engineering", url: "https://browser.engineering/rss.xml", category: "Engineering" },
    { name: "Engineering at Meta", url: "https://engineering.fb.com/feed/", category: "Engineering" },
    { name: "Mind the Product", url: "https://www.mindtheproduct.com/feed/", category: "Engineering" },
    { name: "Julia Evans", url: "https://jvns.ca/atom.xml", category: "Engineering" },
    { name: "Martin Kleppmann", url: "https://feeds.feedburner.com/martinkl?format=xml", category: "Engineering" },
    { name: "Dan Abramov", url: "https://overreacted.io/rss.xml", category: "Engineering" },
    { name: "Dan Luu", url: "https://danluu.com/atom.xml", category: "Engineering" },
    { name: "Shopify Engineering", url: "https://shopifyengineering.myshopify.com/blogs/engineering.atom", category: "Engineering" },
    { name: "Josh Comeau", url: "https://joshwcomeau.com/rss.xml", category: "Engineering" },
    { name: "Uber Engineering", url: "https://www.uber.com/blog/engineering/rss/", category: "Engineering" },
    { name: "Stripe CTO Blog", url: "https://blog.singleton.io/index.xml", category: "Engineering" },
    { name: "Sophie Alpert", url: "https://sophiebits.com/atom.xml", category: "Engineering" },
    { name: "Amjad Masad", url: "https://amasad.me/rss", category: "Engineering" },
    { name: "Signal Blog", url: "https://signal.org/blog/rss.xml", category: "Engineering" },
    { name: "Joel on Software", url: "https://www.joelonsoftware.com/feed/", category: "Engineering" },
    
    // Machine Learning
    { name: "ML@CMU", url: "https://blog.ml.cmu.edu/feed/", category: "Machine Learning" },
    { name: "DeepMind", url: "https://deepmind.com/blog/feed/basic/", category: "Machine Learning" },
    { name: "Jay Alammar", url: "https://jalammar.github.io/feed.xml", category: "Machine Learning" },
    { name: "Distill", url: "http://distill.pub/rss.xml", category: "Machine Learning" },
    { name: "Lil'Log", url: "https://lilianweng.github.io/lil-log/feed.xml", category: "Machine Learning" },
    { name: "MIT AI News", url: "http://news.mit.edu/rss/topic/artificial-intelligence2", category: "Machine Learning" },
    { name: "Sebastian Ruder", url: "http://ruder.io/rss/index.rss", category: "Machine Learning" },
    { name: "Berkeley AI Research", url: "http://bair.berkeley.edu/blog/feed.xml", category: "Machine Learning" },
    { name: "DeepLearning.AI", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCcIXc5mJsHVYTZR1maL5l9w", category: "Machine Learning" },
    { name: "Eric Jang", url: "https://evjang.com/feed", category: "Machine Learning" },
    { name: "OpenAI", url: "https://blog.openai.com/rss/", category: "Machine Learning" },
    { name: "The Gradient", url: "https://thegradient.pub/rss/", category: "Machine Learning" },
    { name: "Magenta", url: "http://magenta.tensorflow.org/feed.xml", category: "Machine Learning" },
    { name: "NLP News", url: "http://newsletter.ruder.io/?format=rss", category: "Machine Learning" },
    { name: "Google AI Blog", url: "http://googleresearch.blogspot.com/atom.xml", category: "Machine Learning" },
    { name: "Towards Data Science", url: "https://towardsdatascience.com/feed", category: "Machine Learning" },
    { name: "Unite.AI", url: "https://www.unite.ai/feed/", category: "Machine Learning" },
    { name: "Grammarly Blog", url: "https://www.grammarly.com/blog/feed/", category: "Machine Learning" },
    { name: "Amazon Science", url: "https://www.amazon.science/index.rss", category: "Machine Learning" },
    { name: "r/MachineLearning", url: "http://www.reddit.com/r/MachineLearning/.rss", category: "Machine Learning" },
    { name: "Yannic Kilcher", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew", category: "Machine Learning" },
    { name: "Two Minute Papers", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", category: "Machine Learning" },
    
    // Design
    { name: "UX Planet", url: "https://uxplanet.org/feed", category: "Design" },
    { name: "Nielsen Norman Group", url: "https://www.nngroup.com/feed/rss/", category: "Design" },
    { name: "UX Movement", url: "http://feeds.feedburner.com/uxmovement", category: "Design" },
    { name: "Inside Design", url: "http://blog.invisionapp.com/feed/", category: "Design" },
    { name: "UXmatters", url: "https://uxmatters.com/index.xml", category: "Design" },
    { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", category: "Design" },
    { name: "UX Collective", url: "https://uxdesign.cc/feed", category: "Design" },
    { name: "Airbnb Design", url: "http://airbnb.design/feed/", category: "Design" },
    { name: "web.dev", url: "https://web.dev/feed.xml", category: "Design" },
    { name: "Slack Design", url: "https://slack.design/feed/", category: "Design" },
    { name: "CSS-Tricks", url: "https://feeds.feedburner.com/CssTricks", category: "Design" },
    { name: "IxD Daily", url: "https://interaction-design.org/rss/site_news.xml", category: "Design" },
    
    // Psychology
    { name: "PsyBlog", url: "http://feeds.feedburner.com/PsychologyBlog", category: "Psychology" },
    { name: "All About Psychology", url: "http://www.all-about-psychology.com/psychology.xml", category: "Psychology" },
    { name: "Social Psychology", url: "http://www.socialpsychology.org/headlines.rss", category: "Psychology" },
    { name: "Nautilus", url: "https://nautil.us/rss/all", category: "Psychology" },
    { name: "Freakonomics", url: "http://freakonomics.blogs.nytimes.com/feed/", category: "Psychology" },
    { name: "Psychology Today", url: "https://www.psychologytoday.com/intl/rss.xml", category: "Psychology" },
    
    // Neuroscience
    { name: "Neuroscience News", url: "http://neurosciencenews.com/feed/", category: "Neuroscience" },
    { name: "ScienceDaily Neuroscience", url: "https://sciencedaily.com/rss/mind_brain/neuroscience.xml", category: "Neuroscience" },
    { name: "SharpBrains", url: "http://www.sharpbrains.com/feed/", category: "Neuroscience" },
    
    // Science
    { name: "Quanta Magazine", url: "http://www.quantamagazine.org/feed/", category: "Science" },
    { name: "Nature", url: "http://www.nature.com/nature/current_issue/rss", category: "Science" },
    { name: "MIT News STS", url: "https://news.mit.edu/rss/topic/science-technology-and-society", category: "Science" },
    { name: "MIT News Research", url: "https://news.mit.edu/rss/research", category: "Science" },
    { name: "ScienceAlert", url: "https://www.sciencealert.com/rss", category: "Science" },
    { name: "Singularity Hub", url: "https://singularityhub.com/feed/", category: "Science" },
    { name: "Lesics", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCqZQJ4600a9wIfMPbYc60OQ", category: "Science" },
    
    // Marketing
    { name: "Moz", url: "http://feeds.feedburner.com/seomoz", category: "Marketing" },
    { name: "Content Marketing Institute", url: "http://feeds.feedburner.com/cmi-content-marketing", category: "Marketing" },
    { name: "Neil Patel", url: "http://feeds.feedburner.com/KISSmetrics", category: "Marketing" },
    { name: "MarketingProfs", url: "http://rss.marketingprofs.com/marketingprofs/daily", category: "Marketing" },
    { name: "Marketo", url: "http://feeds.feedburner.com/modernb2bmarketing", category: "Marketing" },
    { name: "Quick Sprout", url: "http://www.quicksprout.com/feed/rss/", category: "Marketing" },
    { name: "Social Media Examiner", url: "http://www.socialmediaexaminer.com/feed/", category: "Marketing" },
    { name: "John Egan", url: "http://jwegan.com/feed/rss/", category: "Marketing" },
    { name: "Convince and Convert", url: "http://www.convinceandconvert.com/feed/", category: "Marketing" },
    { name: "HubSpot", url: "http://blog.hubspot.com/CMS/UI/Modules/BizBlogger/rss.aspx?tabid=6307&moduleid=8441&maxcount=25", category: "Marketing" },
    { name: "Seth Godin", url: "http://sethgodin.typepad.com/seths_blog/atom.xml", category: "Marketing" },
    { name: "Backlinko", url: "http://backlinko.com/feed", category: "Marketing" },
    
    // Others
    { name: "TED Talks Daily", url: "http://feeds.feedburner.com/tedtalks_video", category: "Others" },
    { name: "Harvard Business Review", url: "http://feeds.harvardbusiness.org/harvardbusiness/", category: "Others" }
];

async function seedRSSSources() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Clear existing sources
        await RSSSource.deleteMany({});
        console.log('Cleared existing RSS sources');
        
        // Insert new sources
        await RSSSource.insertMany(rssSources);
        console.log(`✓ Inserted ${rssSources.length} RSS sources`);
        
        // Show summary by category
        const categories = await RSSSource.distinct('category');
        for (const category of categories) {
            const count = await RSSSource.countDocuments({ category });
            console.log(`  - ${category}: ${count} sources`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding RSS sources:', error);
        process.exit(1);
    }
}

seedRSSSources();
