


const axios = require('axios');

const POPCAT_API_URL = (process.env.POPCAT_API_URL || 'https://api.popcat.xyz').replace(/\/+$/, '');

const http = axios.create({
    timeout: 4000,
    headers: {
        'User-Agent': 'FluenosityBot/1.0 (DiscordBot; +https://fluenosity.com)',
        'Accept': 'application/json'
    }
});

function pickRandom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&eacute;/g, 'é')
        .replace(/&Eacute;/g, 'É')
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&uuml;/g, 'ü')
        .replace(/&ouml;/g, 'ö')
        .replace(/&auml;/g, 'ä')
        .replace(/&deg;/g, '°')
        .replace(/&#(\d+);/g, (match, dec) => {
            const num = parseInt(dec, 10);
            return !isNaN(num) ? String.fromCharCode(num) : match;
        });
}

const fallbackFacts = [
    { text: "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible." },
    { text: "A day on Venus is longer than a year on Venus. It takes Venus longer to rotate once on its axis than to complete one orbit around the Sun." },
    { text: "Bananas are curved because they grow towards the sun against gravity, a process known as negative geotropism." },
    { text: "Octopuses have three hearts and their blood is copper-based and blue in color." },
    { text: "Wombat feces is cube-shaped, which prevents it from rolling away and marks their territory effectively." },
    { text: "Nintendo was founded as a playing card company in Kyoto, Japan, way back in 1889." },
    { text: "There are more trees on Earth (approx. 3 trillion) than there are stars in the Milky Way galaxy (100–400 billion)." },
    { text: "The heart of a blue whale is so colossal that a human child could swim through its major arteries." },
    { text: "Oxford University is older than the Aztec Empire. Teaching existed at Oxford in 1096, while the Aztec civilization began around 1325." },
    { text: "Cleopatra lived closer in time to the launch of the iPhone than to the construction of the Great Pyramid of Giza." },
    { text: "Hot water turns into ice faster than cold water under certain conditions, a phenomenon known as the Mpemba effect." },
    { text: "A group of flamingos is officially known as a 'flamboyance'." },
    { text: "Sharks existed on Earth before trees did. The earliest evidence for shark scales dates back 450 million years, while the earliest tree lived 350 million years ago." },
    { text: "Scotland's official national animal is the Unicorn." },
    { text: "The dot over the lower-case letters 'i' and 'j' is called a 'tittle'." },
    { text: "Humans share approximately 50% of their DNA with bananas." },
    { text: "A single bolt of lightning contains enough energy to toast over 100,000 slices of bread." },
    { text: "Sea otters hold hands while they sleep to keep from drifting apart in the water." },
    { text: "A cloud can weigh more than 1 million pounds (roughly 500,000 kilograms), floating on the denser air beneath it." },
    { text: "Sloths can hold their breath underwater for up to 40 minutes, whereas dolphins can only hold theirs for about 10 minutes." },
    { text: "The total weight of all the ants on Earth is estimated to be roughly equal to the weight of all humans." },
    { text: "The moon has moonquakes, caused by tidal stresses from Earth, meteoroid impacts, and thermal expansion." }
];

const fallbackJokes = [
    { setup: "Why don't skeletons fight each other?", punchline: "They don't have the guts.", category: "General" },
    { setup: "What do you call a fake noodle?", punchline: "An impasta.", category: "Pun" },
    { setup: "Why did the scarecrow win an award?", punchline: "Because he was outstanding in his field.", category: "Dad" },
    { setup: "How does a penguin build its house?", punchline: "Igloos it together!", category: "General" },
    { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up.", category: "Pun" },
    { setup: "What do you call a factory that makes good products?", punchline: "A satisfactory.", category: "Wordplay" },
    { setup: "Why did the bicycle fall over?", punchline: "Because it was two-tired.", category: "Dad" },
    { setup: "What do you call cheese that isn't yours?", punchline: "Nacho cheese.", category: "Pun" },
    { setup: "Why can't your nose be 12 inches long?", punchline: "Because then it would be a foot!", category: "General" },
    { setup: "How do you organize a space party?", punchline: "You planet.", category: "Space" },
    { setup: "What do you call a bear with no teeth?", punchline: "A gummy bear.", category: "General" },
    { setup: "Why did the math book look sad?", punchline: "Because it had too many problems.", category: "School" },
    { setup: "What kind of tea is hard to swallow?", punchline: "Reality.", category: "Wisdom" },
    { setup: "Where do fish keep their money?", punchline: "In the riverbank.", category: "Pun" },
    { setup: "What do you call an alligator in a vest?", punchline: "An investigator.", category: "Wordplay" }
];

const fallbackMemes = [
    { name: "Distracted Boyfriend", url: "https://i.imgflip.com/1ur9b0.jpg" },
    { name: "Drake Hotline Bling", url: "https://i.imgflip.com/30b1gx.jpg" },
    { name: "Two Buttons", url: "https://i.imgflip.com/1g8my4.jpg" },
    { name: "Change My Mind", url: "https://i.imgflip.com/24y43o.jpg" },
    { name: "Left Exit 12 Off Ramp", url: "https://i.imgflip.com/22bdq6.jpg" },
    { name: "Buff Doge vs. Cheems", url: "https://i.imgflip.com/43a45p.png" },
    { name: "Expanding Brain", url: "https://i.imgflip.com/1jwhww.jpg" },
    { name: "Woman Yelling At A Cat", url: "https://i.imgflip.com/345v97.jpg" },
    { name: "Is This A Pigeon", url: "https://i.imgflip.com/1o00in.jpg" },
    { name: "Always Has Been", url: "https://i.imgflip.com/46e43q.png" },
    { name: "Bernie I Am Once Again Asking", url: "https://i.imgflip.com/3o43zk.jpg" },
    { name: "Trade Offer", url: "https://i.imgflip.com/54hjww.jpg" },
    { name: "Epic Handshake", url: "https://i.imgflip.com/28j0te.jpg" },
    { name: "Panik Kalm Panik", url: "https://i.imgflip.com/3qqcim.png" },
    { name: "Uno Draw 25 Cards", url: "https://i.imgflip.com/3lmzyx.jpg" }
];

const fallbackQuotes = [
    { content: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt", tags: ["Inspirational"] },
    { content: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", tags: ["Courage"] },
    { content: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt", tags: ["Motivation"] },
    { content: "Keep your face always toward the sunshine—and shadows will fall behind you.", author: "Walt Whitman", tags: ["Optimism"] },
    { content: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein", tags: ["Wisdom"] },
    { content: "Happiness is not something readymade. It comes from your own actions.", author: "Dalai Lama", tags: ["Happiness"] },
    { content: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", tags: ["Perseverance"] },
    { content: "You must be the change you wish to see in the world.", author: "Mahatma Gandhi", tags: ["Inspirational"] },
    { content: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle", tags: ["Excellence"] },
    { content: "The secret of getting ahead is getting started.", author: "Mark Twain", tags: ["Motivation"] },
    { content: "Turn your wounds into wisdom.", author: "Oprah Winfrey", tags: ["Resilience"] },
    { content: "Believe you can and you're halfway there.", author: "Theodore Roosevelt", tags: ["Belief"] },
    { content: "Waste no more time arguing what a good man should be. Be one.", author: "Marcus Aurelius", tags: ["Stoicism"] }
];

const fallbackCatFacts = [
    "Cats sleep for roughly 70% of their lives.",
    "A cat's purr has vibrational frequencies (20-140 Hz) known to aid in bone repair and tissue healing.",
    "Cats have 32 muscles in each outer ear, allowing them to rotate their ears 180 degrees independently.",
    "The first cat in space was a French feline named Félicette in 1963, and she safely returned to Earth.",
    "A group of cats is called a 'clowder', while a group of kittens is called a 'kindle'.",
    "A cat's sense of smell is roughly 14 times stronger than that of a human.",
    "Cats cannot taste sweetness due to a genetic lack of sweet taste receptors.",
    "A cat can jump up to six times its own height in a single bound.",
    "Every cat's nose print has a unique pattern of ridges, just like a human fingerprint.",
    "Cats walk like camels and giraffes: they move both right feet first, then both left feet.",
    "Black cats are considered good luck and symbols of prosperity in Britain, Scotland, and Japan.",
    "Cats have a third eyelid called the nictitating membrane that protects their eyes.",
    "Isaac Newton is often credited with inventing the modern cat flap door for his pets.",
    "Cats spend between 30% and 50% of their awake hours grooming themselves."
];

const fallbackDogFacts = [
    "All domestic dogs can trace their genetic ancestry back to ancient wolf ancestors.",
    "A dog's nose print is completely unique, comparable to a human fingerprint.",
    "Three dogs famously survived the historical sinking of the Titanic in 1912.",
    "Dogs have three eyelids, including the haw which keeps the cornea clean and moist.",
    "A dog's sense of smell is between 10,000 to 100,000 times more sensitive than a human's.",
    "Dogs dream just like humans do! Small dogs dream more frequently than large dogs.",
    "A Greyhound can reach speeds of up to 45 miles per hour (72 km/h) in just seconds.",
    "The Basenji is known as the 'barkless dog' because it produces a unique yodel-like sound instead.",
    "Dogs have about 1,700 taste buds, while humans have around 9,000.",
    "A dog's wet nose helps absorb scent chemicals from the air for better odor tracking.",
    "Puppies are born blind, deaf, and toothless, relying entirely on touch and scent for their first weeks.",
    "Dalmatians are born completely white; their iconic black spots develop as they grow older."
];

const fallbackChuckNorris = [
    "Chuck Norris doesn't read books. He stares them down until he gets the information he wants.",
    "Chuck Norris can slam a revolving door.",
    "Chuck Norris can divide by zero.",
    "Chuck Norris doesn't wear a watch. He decides what time it is.",
    "Fear of spiders is arachnophobia, fear of tight spaces is claustrophobia, fear of Chuck Norris is called Logic.",
    "Chuck Norris once counted to infinity. Twice.",
    "Chuck Norris can light a fire by rubbing two ice cubes together.",
    "When Alexander Graham Bell invented the telephone, he had three missed calls from Chuck Norris.",
    "Chuck Norris doesn't sleep. He waits.",
    "Chuck Norris can hear sign language.",
    "Chuck Norris can drown a fish.",
    "Death once had a near-Chuck-Norris experience."
];

const fallbackDadJokes = [
    "Why don't skeletons fight each other? They don't have the guts.",
    "What do you call a fake noodle? An impasta.",
    "I would tell you a joke about construction, but I'm still working on it.",
    "Why did the bullet end up losing its job? It got fired.",
    "Did you hear about the guy who invented the knock-knock joke? He won the no-bell prize.",
    "My wife told me to stop impersonating a flamingo. I had to put my foot down.",
    "I used to play piano by ear, but now I use my hands.",
    "What do you call a belt made of watches? A waist of time.",
    "How does Moses make his coffee? Hebrews it.",
    "Why do fathers take an extra pair of socks golfing? In case they get a hole in one.",
    "What do you call an elephant that doesn't matter? An irrelephant.",
    "I'm afraid for the calendar. Its days are numbered."
];

const fallbackAdvice = [
    "Never let the fear of striking out keep you from playing the game.",
    "Be kind to unkind people. They often need it the most.",
    "Learn to say 'no' without offering elaborate explanations.",
    "Do not compare yourself to others; compare yourself to who you were yesterday.",
    "Before criticizing someone, remember that not everyone had the advantages you enjoyed.",
    "Invest in your sleep: you spend one-third of your life in bed.",
    "The best way to predict the future is to create it.",
    "Never make permanent decisions based on temporary emotions.",
    "Listen twice as much as you speak. There's a reason we have two ears and one mouth.",
    "When in doubt, choose the option that makes for a better story 10 years from now.",
    "Forgive others, not because they always deserve forgiveness, but because you deserve peace.",
    "Take care of your body. It's the only place you have to live."
];

const fallbackActivities = [
    { activity: "Write a letter or journal entry to your future self 5 years from now.", type: "recreational", participants: 1 },
    { activity: "Organize your room, digital files, or desk workspace.", type: "busywork", participants: 1 },
    { activity: "Go for a brisk 20-minute walk outdoors with no screen distraction.", type: "relaxation", participants: 1 },
    { activity: "Learn how to fold a paper crane using the art of origami.", type: "education", participants: 1 },
    { activity: "Call or message a friend or family member you haven't spoken to in a while.", type: "social", participants: 2 },
    { activity: "Bake homemade cookies or try a recipe you've never cooked before.", type: "cooking", participants: 1 },
    { activity: "Listen to a full music album from start to finish with closed eyes.", type: "music", participants: 1 },
    { activity: "Solve a crossword puzzle or Sudoku grid.", type: "education", participants: 1 },
    { activity: "Start reading a book outside your favorite genre.", type: "education", participants: 1 },
    { activity: "Create a curated playlist of 10 songs that boost your focus or mood.", type: "music", participants: 1 }
];

const fallbackRiddles = [
    { riddle: "What has keys but no locks, space but no room, and you can enter but can't go inside?", answer: "A keyboard" },
    { riddle: "I am not alive, but I grow; I don't have lungs, but I need air; I don't have a mouth, but water kills me. What am I?", answer: "Fire" },
    { riddle: "What comes once in a minute, twice in a moment, but never in a thousand years?", answer: "The letter M" },
    { riddle: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", answer: "A map" },
    { riddle: "What can travel around the world while staying in a corner?", answer: "A stamp" },
    { riddle: "The more of this there is, the less you see. What is it?", answer: "Darkness" },
    { riddle: "What belongs to you, but everyone else uses it much more than you do?", answer: "Your name" },
    { riddle: "What has a neck but no head, and two arms but no hands?", answer: "A shirt" },
    { riddle: "What gets wetter the more it dries?", answer: "A towel" },
    { riddle: "If you drop me I'm sure to crack, but give me a smile and I'll always smile back. What am I?", answer: "A mirror" },
    { riddle: "What has hands, but can't clap?", answer: "A clock" },
    { riddle: "What can run, but never walks, has a mouth, but never talks, has a head, but never weeps, has a bed, but never sleeps?", answer: "A river" },
    { riddle: "Forward I am heavy, but backward I am not. What am I?", answer: "The word 'ton'" },
    { riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "An echo" },
    { riddle: "What invention lets you look right through a wall?", answer: "A window" }
];

const fallbackTrivia = [
    { question: "Which planet is known as the Red Planet?", options: ["Mars", "Venus", "Jupiter", "Saturn"], answer: "Mars", category: "Science & Nature", difficulty: "Easy" },
    { question: "Who painted the Mona Lisa?", options: ["Leonardo da Vinci", "Pablo Picasso", "Vincent van Gogh", "Michelangelo"], answer: "Leonardo da Vinci", category: "Art", difficulty: "Easy" },
    { question: "What is the capital city of Australia?", options: ["Canberra", "Sydney", "Melbourne", "Brisbane"], answer: "Canberra", category: "Geography", difficulty: "Medium" },
    { question: "What is the hardest natural substance on Earth?", options: ["Diamond", "Graphene", "Quartz", "Titanium"], answer: "Diamond", category: "Science", difficulty: "Easy" },
    { question: "Which element has the chemical symbol 'Au'?", options: ["Gold", "Silver", "Argon", "Aluminum"], answer: "Gold", category: "Science: Chemistry", difficulty: "Easy" },
    { question: "In what year did the Apollo 11 mission land on the Moon?", options: ["1969", "1965", "1972", "1968"], answer: "1969", category: "History", difficulty: "Medium" },
    { question: "Which ocean is the largest by surface area on Earth?", options: ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], answer: "Pacific Ocean", category: "Geography", difficulty: "Easy" },
    { question: "Who is widely considered the author of 'Romeo and Juliet'?", options: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], answer: "William Shakespeare", category: "Literature", difficulty: "Easy" },
    { question: "How many bones are in the adult human body?", options: ["206", "195", "215", "220"], answer: "206", category: "Science: Anatomy", difficulty: "Medium" },
    { question: "What is the national currency of Japan?", options: ["Yen", "Won", "Yuan", "Ringgit"], answer: "Yen", category: "General Knowledge", difficulty: "Easy" }
];

const fallbackCompliments = [
    "You're absolutely amazing and your presence lights up every room!",
    "Your creativity and unique perspective inspire everyone around you!",
    "You have such wonderful energy that makes people feel comfortable instantly!",
    "Your kindness and compassion make the world a genuinely better place!",
    "You're incredibly intelligent and your insights are always valuable!",
    "You have a contagious sense of humor that brings genuine joy to others!",
    "Your dedication and work ethic are truly admirable.",
    "You are far stronger and more resilient than you even give yourself credit for.",
    "You bring out the best qualities in the people fortunate enough to know you.",
    "Your style and authenticity are refreshing and inspiring.",
    "You are a great listener, and people feel heard and respected around you.",
    "The world is undeniably better with you in it."
];

const fallbackPuns = [
    "I wondered why the baseball kept getting bigger. Then it hit me.",
    "Time flies like an arrow. Fruit flies like a banana.",
    "I used to hate facial hair, but then it grew on me.",
    "The math teacher called in sick with algebra.",
    "I'm reading a book about anti-gravity. It's impossible to put down!",
    "Have you heard about the corduroy pillows? They're making headlines.",
    "I told my doctor that I broke my arm in two places. He told me to stop going to those places.",
    "Did you hear about the guy who lost his whole left side? He's all right now.",
    "I'm on a seafood diet. I see food and I eat it.",
    "Why do we tell actors to 'break a leg'? Because every play has a cast.",
    "A termite walks into the bar and asks, 'Is the bar tender?'",
    "Parallel lines have so much in common. It's a shame they'll never meet."
];

const fallbackWisdom = [
    { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "Know thyself and you will win all battles.", author: "Sun Tzu" },
    { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
    { text: "Be the change that you wish to see in the world.", author: "Mahatma Gandhi" },
    { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
    { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
    { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", author: "Buddha" },
    { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle Onassis" },
    { text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", author: "Ralph Waldo Emerson" },
    { text: "Quiet people have the loudest minds.", author: "Stephen Hawking" },
    { text: "An unexamined life is not worth living.", author: "Socrates" },
    { text: "Happiness depends upon ourselves.", author: "Aristotle" }
];

const fallbackProgramming = [
    "Why do programmers prefer dark mode? Because light attracts bugs!",
    "There are only 10 types of people: those who understand binary and those who don't.",
    "Why did the programmer quit his job? He didn't get arrays!",
    "How many programmers does it take to change a lightbulb? None, that's a hardware problem.",
    "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
    "!false — it's funny because it's true.",
    "There are two hard problems in Computer Science: cache invalidation, naming things, and off-by-one errors.",
    "Programmer: An organism that converts coffee into code and bugs into features.",
    "Software and cathedrals are much the same — first we build them, then we pray.",
    "Why do Java developers wear glasses? Because they don't C#!",
    "Hardware: The part of a computer that you can kick when the software crashes.",
    "Debugging: Being the detective in a crime movie where you are also the murderer."
];

const fallbackSpaceFacts = [
    "One day on Venus is longer than its entire year! Venus rotates so slowly that it takes 243 Earth days to complete one rotation, but only 225 days to orbit the Sun.",
    "If you could drive a car straight up at 60 mph, you would reach space in less than an hour.",
    "Neutron stars are so dense that a single sugar-cube-sized piece would weigh about a billion tons on Earth!",
    "Space is completely silent because there is no air or atmosphere for sound waves to travel through.",
    "Footprints left by astronauts on the Moon will likely stay there for at least 100 million years because there is no wind or water erosion.",
    "The Sun accounts for about 99.86% of all the mass in the entire Solar System.",
    "There is a giant reservoir of water floating in space that holds 140 trillion times the water in Earth's oceans.",
    "Jupiter's Great Red Spot is a monstrous storm that has been raging for centuries and is larger than Earth itself.",
    "A full NASA space suit costs approximately $12 million to construct.",
    "Saturn's density is so low that if you had a bathtub large enough, Saturn would float in it!"
];

const fallbackHistoryFacts = [
    "Cleopatra lived closer in time to the Moon landing (1969) than to the construction of the Great Pyramid of Giza (c. 2560 BC)!",
    "Oxford University is older than the Aztec Empire. Oxford was teaching students in 1096, while the Aztec Empire formed in 1428!",
    "Napoleon was actually average height for French men of his time (5 feet 7 inches); British wartime propaganda labeled him as short.",
    "In ancient Rome, urine was collected and used as a laundry detergent and teeth whitener due to its ammonia content!",
    "Woolly mammoths were still roaming Wrangel Island in the Arctic when the Egyptians were finishing the Great Pyramids.",
    "The shortest war in recorded history was between Britain and Zanzibar in 1896. Zanzibar surrendered after just 38 minutes!",
    "Ketchup was once sold in the 1830s in the United States as a patented medicine to cure diarrhea and indigestion.",
    "Albert Einstein was offered the presidency of Israel in 1952, but he politely declined the offer."
];

const fallbackScienceFacts = [
    "Honey never spoils! Archaeologists have discovered pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly safe to eat.",
    "Your stomach gets an entirely new mucosal lining every 3-5 days; otherwise, its own stomach acid would digest it!",
    "Octopuses have three hearts, nine brains, and their blood is distinctly blue because it uses copper instead of iron.",
    "DNA is astonishingly long: if you uncoiled all the DNA in your body, it would stretch from Earth to Pluto and back!",
    "A single teaspoon of honey is the life work of 12 worker honeybees.",
    "Water can exist in three states (solid, liquid, and gas) simultaneously at its 'triple point' temperature and pressure.",
    "Bananas emit a minuscule amount of radiation because they are rich in potassium, specifically the radioactive isotope potassium-40.",
    "Glass is technically an amorphous solid, occupying a state of matter between crystalline solids and liquids."
];

const fallbackWords = [
    { word: "Serendipity", definition: "The occurrence of events by chance in a happy or beneficial way", origin: "Persian (via Horace Walpole)" },
    { word: "Ephemeral", definition: "Lasting for a very short, fleeting period of time", origin: "Greek ('ephemeros')" },
    { word: "Ubiquitous", definition: "Present, appearing, or found everywhere at the same time", origin: "Latin ('ubique')" },
    { word: "Petrichor", definition: "The pleasant, earthy scent produced when rain falls on dry soil", origin: "Greek ('petra' + 'ichor')" },
    { word: "Mellifluous", definition: "Pleasingly smooth and musical to hear", origin: "Latin ('mel' = honey)" },
    { word: "Defenestration", definition: "The act of throwing someone or something out of a window", origin: "Latin ('de' + 'fenestra')" },
    { word: "Sonder", definition: "The profound realization that each stranger has a life as vivid and complex as your own", origin: "Dictionary of Obscure Sorrows" },
    { word: "Limerence", definition: "The state of being infatuated or obsessed with another person", origin: "Coined by Dorothy Tennov" },
    { word: "Ineffable", definition: "Too great, extreme, or sacred to be expressed in words", origin: "Latin ('ineffabilis')" },
    { word: "Resilience", definition: "The capacity to withstand or recover quickly from difficulties", origin: "Latin ('resilire')" }
];

const fallbackAcronyms = [
    { acronym: "LASER", meaning: "Light Amplification by Stimulated Emission of Radiation", field: "Physics / Optics" },
    { acronym: "SCUBA", meaning: "Self-Contained Underwater Breathing Apparatus", field: "Marine Diving" },
    { acronym: "RADAR", meaning: "Radio Detection and Ranging", field: "Aviation & Defense" },
    { acronym: "HTML", meaning: "HyperText Markup Language", field: "Web Development" },
    { acronym: "CAPTCHA", meaning: "Completely Automated Public Turing test to tell Computers and Humans Apart", field: "Cybersecurity" },
    { acronym: "SONAR", meaning: "Sound Navigation and Ranging", field: "Marine Navigation" },
    { acronym: "GIF", meaning: "Graphics Interchange Format", field: "Computer Graphics" },
    { acronym: "OLED", meaning: "Organic Light Emitting Diode", field: "Display Technology" },
    { acronym: "RAM", meaning: "Random Access Memory", field: "Computer Hardware" },
    { acronym: "URL", meaning: "Uniform Resource Locator", field: "Internet Protocols" }
];

const fallbackFortunes = [
    "A thrilling opportunity will soon present itself. Embrace it with courage!",
    "Your creativity and ingenuity will unlock doors that were previously closed.",
    "Someone you haven't spoken to in a while will bring warm and positive news.",
    "Great things never came from comfort zones. Take that exciting calculated leap!",
    "Patience is bitter, but its fruit is extraordinarily sweet.",
    "A journey of exploration is about to begin. Keep your mind open to wonder.",
    "Your acts of kindness ripple outward in ways you may never fully witness.",
    "An unexpected windfall or blessing is headed your way in the coming weeks.",
    "Trust your instincts; your subconscious has connected dots your conscious mind hasn't yet seen.",
    "Today's discipline will become tomorrow's greatest pride and success."
];

const fallbackAnime = [
    { quote: "It's not the face that makes someone a monster, it's the choices they make with their lives.", character: "Naruto Uzumaki", anime: "Naruto" },
    { quote: "A lesson without pain is meaningless. For you cannot gain anything without sacrificing something in return.", character: "Edward Elric", anime: "Fullmetal Alchemist: Brotherhood" },
    { quote: "If you don't take risks, you can't create a future.", character: "Monkey D. Luffy", anime: "One Piece" },
    { quote: "Power isn't determined by your size, but the size of your heart and dreams.", character: "Monkey D. Luffy", anime: "One Piece" },
    { quote: "Whatever you do, enjoy it to the fullest. That is the secret of life.", character: "Rider (Iskandar)", anime: "Fate/Zero" },
    { quote: "Fear is not evil. It tells you what your weakness is. Once you know your weakness, you can become stronger.", character: "Gildarts Clive", anime: "Fairy Tail" },
    { quote: "Hard work is worthless for those that don't believe in themselves.", character: "Naruto Uzumaki", anime: "Naruto" },
    { quote: "If you really want to be strong, stop caring about what other people think about you!", character: "Saitama", anime: "One Punch Man" },
    { quote: "The world isn't perfect. But it's there for us, doing the best it can... that's what makes it so damn beautiful.", character: "Roy Mustang", anime: "Fullmetal Alchemist" },
    { quote: "Push through the pain. Giving up hurts more.", character: "Vegeta", anime: "Dragon Ball Z" },
    { quote: "No matter how deep the night, it always turns to day, eventually.", character: "Brook", anime: "One Piece" },
    { quote: "If you just submit to fate, then that's the end of it.", character: "Mikasa Ackerman", anime: "Attack on Titan" }
];

async function getFact() {
    
    try {
        const res = await http.get('https://uselessfacts.jsph.pl/random.json?language=en');
        if (res.data?.text) {
            return { text: res.data.text.trim() };
        }
    } catch (_) {}

    
    try {
        const res = await http.get(`${POPCAT_API_URL}/fact`);
        if (res.data?.fact) {
            return { text: res.data.fact.trim() };
        }
    } catch (_) {}

    
    return pickRandom(fallbackFacts);
}

async function getJoke() {
    
    try {
        const res = await http.get('https://official-joke-api.appspot.com/random_joke');
        if (res.data?.setup && res.data?.punchline) {
            return {
                setup: res.data.setup.trim(),
                punchline: res.data.punchline.trim(),
                category: res.data.type || 'General'
            };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://v2.jokeapi.dev/joke/Any?safe-mode');
        if (!res.data.error) {
            if (res.data.type === 'twopart' && res.data.setup && res.data.delivery) {
                return {
                    setup: res.data.setup.trim(),
                    punchline: res.data.delivery.trim(),
                    category: res.data.category || 'General'
                };
            } else if (res.data.type === 'single' && res.data.joke) {
                return {
                    setup: res.data.joke.trim(),
                    punchline: '',
                    category: res.data.category || 'General'
                };
            }
        }
    } catch (_) {}

    
    return pickRandom(fallbackJokes);
}

async function getMeme() {
    
    try {
        const res = await http.get('https://meme-api.com/gimme');
        if (res.data?.url && !res.data.nsfw) {
            return {
                name: res.data.title || 'Random Meme',
                url: res.data.url
            };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://api.imgflip.com/get_memes');
        const memes = res.data?.data?.memes;
        if (Array.isArray(memes) && memes.length > 0) {
            const randomMeme = pickRandom(memes);
            return {
                name: randomMeme.name || 'Random Meme',
                url: randomMeme.url
            };
        }
    } catch (_) {}

    
    return pickRandom(fallbackMemes);
}

async function getQuote() {
    
    try {
        const res = await http.get('https://zenquotes.io/api/random');
        if (Array.isArray(res.data) && res.data[0]?.q && res.data[0]?.a) {
            return {
                content: res.data[0].q.trim(),
                author: res.data[0].a.trim(),
                tags: ['Inspiration']
            };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://stoic-quotes.com/api/quote');
        if (res.data?.text && res.data?.author) {
            return {
                content: res.data.text.trim(),
                author: res.data.author.trim(),
                tags: ['Stoic Wisdom']
            };
        }
    } catch (_) {}

    
    return pickRandom(fallbackQuotes);
}

async function getCatFact() {
    
    try {
        const res = await http.get('https://catfact.ninja/fact');
        if (res.data?.fact) {
            return { fact: res.data.fact.trim() };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://meowfacts.herokuapp.com/');
        if (Array.isArray(res.data?.data) && res.data.data[0]) {
            return { fact: res.data.data[0].trim() };
        }
    } catch (_) {}

    
    return { fact: pickRandom(fallbackCatFacts) };
}

async function getDogFact() {
    
    try {
        const res = await http.get('https://dog-api.kinduff.com/api/facts');
        if (Array.isArray(res.data?.facts) && res.data.facts[0]) {
            return { fact: res.data.facts[0].trim() };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://dogapi.dog/api/v2/facts');
        const body = res.data?.data?.[0]?.attributes?.body;
        if (body) {
            return { fact: body.trim() };
        }
    } catch (_) {}

    
    return { fact: pickRandom(fallbackDogFacts) };
}

async function getChuckNorris() {
    
    try {
        const res = await http.get('https://api.chucknorris.io/jokes/random');
        if (res.data?.value) {
            return { joke: res.data.value.trim() };
        }
    } catch (_) {}

    
    return { joke: pickRandom(fallbackChuckNorris) };
}

async function getDadJoke() {
    
    try {
        const res = await http.get('https://icanhazdadjoke.com/', {
            headers: { 'Accept': 'application/json' }
        });
        if (res.data?.joke) {
            return { joke: res.data.joke.trim() };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://official-joke-api.appspot.com/jokes/general/random');
        const j = Array.isArray(res.data) ? res.data[0] : res.data;
        if (j?.setup && j?.punchline) {
            return { joke: `${j.setup.trim()} — ${j.punchline.trim()}` };
        }
    } catch (_) {}

    
    return { joke: pickRandom(fallbackDadJokes) };
}

async function getAdvice() {
    
    try {
        const res = await http.get('https://api.adviceslip.com/advice');
        if (res.data?.slip?.advice) {
            return { advice: res.data.slip.advice.trim() };
        }
    } catch (_) {}

    
    return { advice: pickRandom(fallbackAdvice) };
}

async function getActivity() {
    
    try {
        const res = await http.get('https://bored-api.appbrewery.com/random');
        if (res.data?.activity) {
            return {
                activity: res.data.activity.trim(),
                type: res.data.type || 'recreational',
                participants: res.data.participants ?? 1
            };
        }
    } catch (_) {}

    
    return pickRandom(fallbackActivities);
}

async function getTrivia() {
    
    try {
        const res = await http.get('https://opentdb.com/api.php?amount=1&type=multiple');
        if (res.data?.results?.[0]) {
            const trivia = res.data.results[0];
            const decodedQuestion = decodeHtmlEntities(trivia.question);
            const decodedCorrect = decodeHtmlEntities(trivia.correct_answer);
            const options = [
                decodedCorrect,
                ...trivia.incorrect_answers.map(ans => decodeHtmlEntities(ans))
            ];
            options.sort(() => Math.random() - 0.5);

            return {
                question: decodedQuestion,
                options,
                answer: decodedCorrect,
                category: decodeHtmlEntities(trivia.category || 'General Knowledge'),
                difficulty: trivia.difficulty ? (trivia.difficulty.charAt(0).toUpperCase() + trivia.difficulty.slice(1)) : 'Medium'
            };
        }
    } catch (_) {}

    
    const t = pickRandom(fallbackTrivia);
    const options = [...t.options];
    options.sort(() => Math.random() - 0.5);
    return {
        question: t.question,
        options,
        answer: t.answer,
        category: t.category,
        difficulty: t.difficulty
    };
}

async function getScience() {
    
    try {
        const cat = pickRandom([17, 18, 19, 30]); 
        const res = await http.get(`https://opentdb.com/api.php?amount=1&category=${cat}`);
        if (res.data?.results?.[0]) {
            const item = res.data.results[0];
            const q = decodeHtmlEntities(item.question);
            const a = decodeHtmlEntities(item.correct_answer);
            const catName = decodeHtmlEntities(item.category || 'Science & Nature');

            if (item.type === 'boolean') {
                if (a.toLowerCase() === 'true') {
                    return { fact: `🔬 **Scientific Fact:** ${q}\n*(Category: ${catName})*` };
                } else {
                    return { fact: `🔬 **Did you know?** Many believe "${q}", but scientific testing shows this is **False**!\n*(Category: ${catName})*` };
                }
            } else {
                return { fact: `🔬 **Did you know?** ${q}\n\n**Scientific Fact:** **${a}**\n*(Category: ${catName})*` };
            }
        }
    } catch (_) {}

    
    try {
        const res = await http.get(`${POPCAT_API_URL}/fact`);
        if (res.data?.fact) {
            return { fact: `🔬 ${res.data.fact.trim()}` };
        }
    } catch (_) {}

    
    return { fact: pickRandom(fallbackScienceFacts) };
}

async function getSpaceFact() {
    
    try {
        const res = await http.get('http://api.open-notify.org/astros.json');
        if (res.data?.number && Array.isArray(res.data?.people)) {
            const count = res.data.number;
            const names = res.data.people.map(p => `${p.name} (${p.craft})`).slice(0, 5).join(', ');
            return {
                fact: `🚀 **Live Spaceflight Report:** There are currently **${count} humans** living and working in Earth orbit right now aboard space stations like the ISS and Tiangong!\n\n• **Astronauts include:** ${names}...`
            };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://opentdb.com/api.php?amount=1&category=17');
        if (res.data?.results?.[0]) {
            const item = res.data.results[0];
            const q = decodeHtmlEntities(item.question);
            const a = decodeHtmlEntities(item.correct_answer);
            return { fact: `🌌 **Space & Science:** ${q}\n\n**Fact:** **${a}**` };
        }
    } catch (_) {}

    
    return { fact: pickRandom(fallbackSpaceFacts) };
}

async function getHistory() {
    
    try {
        const res = await http.get('https://history.muffinlabs.com/date');
        const events = res.data?.data?.Events;
        if (Array.isArray(events) && events.length > 0) {
            const ev = pickRandom(events);
            const dateStr = res.data.date || 'Today';
            return {
                fact: `📜 **On this day in History (${dateStr}, ${ev.year}):**\n${ev.text}`
            };
        }
    } catch (_) {}

    
    return { fact: pickRandom(fallbackHistoryFacts) };
}

async function getProgramming() {
    
    try {
        const res = await http.get('https://v2.jokeapi.dev/joke/Programming?safe-mode');
        if (!res.data.error) {
            if (res.data.type === 'twopart' && res.data.setup && res.data.delivery) {
                return { joke: `${res.data.setup.trim()}\n\n*${res.data.delivery.trim()}*` };
            } else if (res.data.type === 'single' && res.data.joke) {
                return { joke: res.data.joke.trim() };
            }
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://official-joke-api.appspot.com/jokes/programming/random');
        const j = Array.isArray(res.data) ? res.data[0] : res.data;
        if (j?.setup && j?.punchline) {
            return { joke: `${j.setup.trim()}\n\n*${j.punchline.trim()}*` };
        }
    } catch (_) {}

    
    return { joke: pickRandom(fallbackProgramming) };
}

async function getPun() {
    
    try {
        const res = await http.get('https://v2.jokeapi.dev/joke/Pun?safe-mode');
        if (!res.data.error) {
            if (res.data.type === 'twopart' && res.data.setup && res.data.delivery) {
                return { pun: `${res.data.setup.trim()} — *${res.data.delivery.trim()}*` };
            } else if (res.data.type === 'single' && res.data.joke) {
                return { pun: res.data.joke.trim() };
            }
        }
    } catch (_) {}

    
    return { pun: pickRandom(fallbackPuns) };
}

async function getRiddle() {
    
    try {
        const res = await http.get('https://riddles-api.vercel.app/random');
        if (res.data?.riddle && res.data?.answer) {
            return {
                riddle: res.data.riddle.trim(),
                answer: res.data.answer.trim()
            };
        }
    } catch (_) {}

    
    return pickRandom(fallbackRiddles);
}

async function getWisdom() {
    
    try {
        const res = await http.get('https://stoic-quotes.com/api/quote');
        if (res.data?.text && res.data?.author) {
            return {
                text: res.data.text.trim(),
                author: res.data.author.trim()
            };
        }
    } catch (_) {}

    
    try {
        const res = await http.get('https://zenquotes.io/api/random');
        if (Array.isArray(res.data) && res.data[0]?.q && res.data[0]?.a) {
            return {
                text: res.data[0].q.trim(),
                author: res.data[0].a.trim()
            };
        }
    } catch (_) {}

    
    return pickRandom(fallbackWisdom);
}

async function getFortune() {
    
    try {
        const res = await http.get('https://api.justyy.workers.dev/api/fortune');
        if (typeof res.data === 'string' && res.data.trim()) {
            const clean = res.data.replace(/\\n/g, '\n').replace(/\\t/g, ' ').trim().replace(/^"|"$/g, '');
            if (clean && clean.length > 5) {
                return { fortune: clean };
            }
        }
    } catch (_) {}

    
    return { fortune: pickRandom(fallbackFortunes) };
}

async function getAnime() {
    
    try {
        const res = await http.get('https://katanime.vercel.app/api/getrandom');
        const results = res.data?.result;
        if (Array.isArray(results) && results.length > 0) {
            const q = pickRandom(results);
            if (q?.english && q?.character) {
                return {
                    quote: q.english.trim(),
                    character: q.character.trim(),
                    anime: q.anime ? q.anime.trim() : 'Anime'
                };
            }
        }
    } catch (_) {}

    
    return pickRandom(fallbackAnime);
}

async function getCompliment() {
    return { text: pickRandom(fallbackCompliments) };
}

async function getWord() {
    
    try {
        const wildcard = pickRandom(['??????', '???????', '????????']);
        const res = await http.get(`https://api.datamuse.com/words?sp=${wildcard}&md=d&max=40`);
        const withDefs = (res.data || []).filter(w => w.defs && w.defs.length > 0 && /^[a-z]+$/i.test(w.word));
        if (withDefs.length > 0) {
            const item = pickRandom(withDefs);
            const raw = item.defs[0];
            const parts = raw.split('\t');
            const pos = parts[0] === 'n' ? 'Noun' : parts[0] === 'v' ? 'Verb' : parts[0] === 'adj' ? 'Adjective' : 'Vocabulary';
            const def = (parts[1] || parts[0]).trim();
            if (def) {
                return {
                    word: item.word.charAt(0).toUpperCase() + item.word.slice(1),
                    definition: def,
                    origin: pos
                };
            }
        }
    } catch (_) {}

    
    return pickRandom(fallbackWords);
}

async function getAcronym() {
    
    try {
        const cat = pickRandom([18, 9, 17]); 
        const res = await http.get(`https://opentdb.com/api.php?amount=30&category=${cat}`);
        if (Array.isArray(res.data?.results)) {
            const matches = [];
            for (const item of res.data.results) {
                const q = decodeHtmlEntities(item.question);
                const m = q.match(/([A-Z0-9]{2,10})\s+stand\s+for/i);
                if (m && m[1]) {
                    matches.push({
                        acronym: m[1].toUpperCase(),
                        meaning: decodeHtmlEntities(item.correct_answer),
                        field: decodeHtmlEntities(item.category || 'Technology')
                    });
                }
            }
            if (matches.length > 0) {
                return pickRandom(matches);
            }
        }
    } catch (_) {}

    
    const commonAcronyms = [
        'NASA', 'LASER', 'SCUBA', 'RADAR', 'HTML', 'OLED', 'CAPTCHA',
        'SONAR', 'UNESCO', 'NATO', 'JPEG', 'RAM', 'USB', 'WiFi', 'ASCII',
        'CPU', 'GPU', 'BIOS', 'SATA', 'HDMI', 'PNG', 'PDF', 'IP', 'DNS'
    ];
    try {
        const ac = pickRandom(commonAcronyms);
        const res = await http.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${ac}`, {
            headers: { 'User-Agent': 'FluenosityBot/1.0 (contact@fluenosity.com)' }
        });
        if (res.data?.title) {
            return {
                acronym: ac,
                meaning: res.data.title,
                field: res.data.description || 'Technology & Science'
            };
        }
    } catch (_) {}

    
    return pickRandom(fallbackAcronyms);
}

module.exports = {
    getFact,
    getJoke,
    getMeme,
    getQuote,
    getCatFact,
    getDogFact,
    getChuckNorris,
    getDadJoke,
    getAdvice,
    getActivity,
    getTrivia,
    getScience,
    getSpaceFact,
    getHistory,
    getProgramming,
    getPun,
    getRiddle,
    getWisdom,
    getFortune,
    getAnime,
    getCompliment,
    getWord,
    getAcronym,
    pickRandom,
    decodeHtmlEntities
};
