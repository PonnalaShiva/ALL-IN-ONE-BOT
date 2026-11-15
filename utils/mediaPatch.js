


const mediacord = require('mediacord');
const axios = require('axios');

const http = axios.create({
    timeout: 4500,
    headers: {
        'User-Agent': 'FluenosityBot/1.0 (DiscordBot; +https://fluenosity.com)'
    }
});


async function fetchNekosBest(endpoint) {
    const res = await http.get(`https://nekos.best/api/v2/${endpoint}`);
    const url = res.data?.results?.[0]?.url;
    if (!url) throw new Error(`[nekos.best] No URL returned for ${endpoint}`);
    return url;
}

async function fetchKawaii(endpoint) {
    const res = await http.get(`https://kawaii.red/api/gif/${endpoint}/token=anonymous`);
    const url = res.data?.response;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        throw new Error(`[kawaii.red] Invalid URL returned for ${endpoint}`);
    }
    return url;
}

async function fetchOtaku(reaction) {
    const res = await http.get(`https://api.otakugifs.xyz/gif?reaction=${reaction}`);
    const url = res.data?.url;
    if (!url) throw new Error(`[otakugifs] No URL returned for ${reaction}`);
    return url;
}

async function fetchPurr(path, nsfw = false) {
    const res = await http.get(`https://purrbot.site/api/img/${nsfw ? 'nsfw' : 'sfw'}/${path}`);
    const url = res.data?.link;
    if (!url) throw new Error(`[purrbot] No URL returned for ${path}`);
    return url;
}

async function fetchNekoBot(type) {
    const res = await http.get(`https://nekobot.xyz/api/image?type=${type}`);
    const url = res.data?.message;
    if (!url) throw new Error(`[nekobot] No URL returned for ${type}`);
    return url;
}

async function fetchCat() {
    const res = await http.get('https://api.thecatapi.com/v1/images/search');
    const url = res.data?.[0]?.url;
    if (!url) throw new Error('[thecatapi] No URL returned');
    return url;
}

async function fetchDog() {
    const res = await http.get('https://dog.ceo/api/breeds/image/random');
    const url = res.data?.message;
    if (!url) throw new Error('[dog.ceo] No URL returned');
    return url;
}

function createFallbackRunner(endpointName, providers) {
    return async function runFallback() {
        let lastError = null;
        for (const provider of providers) {
            try {
                const url = await provider();
                if (url && typeof url === 'string' && url.startsWith('http')) {
                    return url;
                }
            } catch (err) {
                lastError = err;
            }
        }
        throw new Error(`[MediaFallback] All providers failed for "${endpointName}": ${lastError?.message || 'Unknown error'}`);
    };
}

const sfwGifFallbacks = {
    
    amazing: [() => fetchKawaii('amazing'), () => fetchOtaku('celebrate'), () => fetchNekosBest('happy')],
    blush: [() => fetchNekosBest('blush'), () => fetchKawaii('blush'), () => fetchOtaku('blush')],
    confused: [() => fetchOtaku('confused'), () => fetchNekosBest('confused'), () => fetchKawaii('confused')],
    cool: [() => fetchOtaku('cool'), () => fetchKawaii('smoke'), () => fetchNekosBest('smug')],
    cringe: [() => fetchNekosBest('bored'), () => fetchKawaii('confused'), () => fetchOtaku('confused')],
    cry: [() => fetchNekosBest('cry'), () => fetchKawaii('cry'), () => fetchOtaku('cry')],
    drool: [() => fetchOtaku('drool'), () => fetchKawaii('coffee'), () => fetchNekosBest('nom')],
    evillaugh: [() => fetchOtaku('evillaugh'), () => fetchKawaii('laugh'), () => fetchNekosBest('laugh')],
    happy: [() => fetchNekosBest('happy'), () => fetchKawaii('happy'), () => fetchOtaku('happy')],
    laugh: [() => fetchOtaku('laugh'), () => fetchNekosBest('laugh'), () => fetchKawaii('laugh')],
    lonely: [() => fetchKawaii('lonely'), () => fetchOtaku('sad'), () => fetchNekosBest('cry')],
    love: [() => fetchOtaku('love'), () => fetchKawaii('love'), () => fetchNekosBest('hug')],
    mad: [() => fetchOtaku('mad'), () => fetchKawaii('mad'), () => fetchNekosBest('angry')],
    nervous: [() => fetchOtaku('nervous'), () => fetchKawaii('scared'), () => fetchNekosBest('shrug')],
    nosebleed: [() => fetchOtaku('nosebleed'), () => fetchKawaii('nosebleed'), () => fetchNekosBest('blush')],
    nyah: [() => fetchOtaku('nyah'), () => fetchNekosBest('nya'), () => fetchKawaii('purr')],
    pout: [() => fetchOtaku('pout'), () => fetchNekosBest('pout'), () => fetchKawaii('pout')],
    sad: [() => fetchOtaku('sad'), () => fetchNekosBest('cry'), () => fetchKawaii('cry')],
    scared: [() => fetchOtaku('scared'), () => fetchKawaii('scared'), () => fetchNekosBest('shocked')],
    shocked: [() => fetchKawaii('shocked'), () => fetchNekosBest('shocked'), () => fetchOtaku('surprised')],
    shy: [() => fetchOtaku('shy'), () => fetchNekosBest('blush'), () => fetchKawaii('blush')],
    smile: [() => fetchNekosBest('smile'), () => fetchKawaii('smile'), () => fetchOtaku('smile')],
    smug: [() => fetchNekosBest('smug'), () => fetchKawaii('smug'), () => fetchOtaku('smug')],
    surprised: [() => fetchOtaku('surprised'), () => fetchNekosBest('shocked'), () => fetchKawaii('shocked')],
    sweat: [() => fetchOtaku('sweat'), () => fetchKawaii('nervous'), () => fetchNekosBest('confused')],

    
    airkiss: [() => fetchOtaku('airkiss'), () => fetchNekosBest('blowkiss'), () => fetchKawaii('kiss')],
    bite: [() => fetchNekosBest('bite'), () => fetchKawaii('bite'), () => fetchOtaku('bite')],
    bonk: [() => fetchNekosBest('bonk'), () => fetchKawaii('punch'), () => fetchOtaku('slap')],
    boop: [() => fetchKawaii('boop'), () => fetchNekosBest('poke'), () => fetchOtaku('poke')],
    brofist: [() => fetchOtaku('brofist'), () => fetchKawaii('highfive'), () => fetchNekosBest('highfive')],
    bully: [() => fetchNekosBest('slap'), () => fetchKawaii('slap'), () => fetchOtaku('slap')],
    cuddle: [() => fetchNekosBest('cuddle'), () => fetchKawaii('cuddle'), () => fetchOtaku('cuddle')],
    fight: [() => fetchKawaii('fight'), () => fetchNekosBest('punch'), () => fetchOtaku('punch')],
    fluff: [() => fetchPurr('fluff/gif'), () => fetchNekosBest('pat'), () => fetchKawaii('pat')],
    glomp: [() => fetchNekosBest('cuddle'), () => fetchKawaii('hug'), () => fetchOtaku('hug')],
    handhold: [() => fetchNekosBest('handhold'), () => fetchOtaku('handhold'), () => fetchNekosBest('handshake')],
    highfive: [() => fetchNekosBest('highfive'), () => fetchKawaii('highfive'), () => fetchOtaku('clap')],
    hug: [() => fetchNekosBest('hug'), () => fetchKawaii('hug'), () => fetchOtaku('hug')],
    kick: [() => fetchNekosBest('kick'), () => fetchKawaii('punch'), () => fetchOtaku('punch')],
    kiss: [() => fetchNekosBest('kiss'), () => fetchKawaii('kiss'), () => fetchOtaku('kiss')],
    lick: [() => fetchKawaii('lick'), () => fetchOtaku('lick'), () => fetchNekosBest('nom')],
    nuzzle: [() => fetchOtaku('nuzzle'), () => fetchNekosBest('cuddle'), () => fetchKawaii('cuddle')],
    pat: [() => fetchNekosBest('pat'), () => fetchKawaii('pat'), () => fetchOtaku('pat')],
    pinch: [() => fetchOtaku('pinch'), () => fetchKawaii('poke'), () => fetchNekosBest('poke')],
    poke: [() => fetchNekosBest('poke'), () => fetchKawaii('poke'), () => fetchOtaku('poke')],
    protect: [() => fetchKawaii('protect'), () => fetchNekosBest('hug'), () => fetchOtaku('hug')],
    punch: [() => fetchNekosBest('punch'), () => fetchKawaii('punch'), () => fetchOtaku('punch')],
    slap: [() => fetchNekosBest('slap'), () => fetchKawaii('slap'), () => fetchOtaku('slap')],
    smack: [() => fetchOtaku('smack'), () => fetchNekosBest('slap'), () => fetchKawaii('slap')],
    tickle: [() => fetchNekosBest('tickle'), () => fetchKawaii('tickle'), () => fetchOtaku('tickle')],

    
    bleh: [() => fetchOtaku('bleh'), () => fetchNekosBest('bleh'), () => fetchKawaii('blyat')],
    cheers: [() => fetchOtaku('cheers'), () => fetchKawaii('party'), () => fetchNekosBest('happy')],
    clap: [() => fetchNekosBest('clap'), () => fetchKawaii('clap'), () => fetchOtaku('clap')],
    dance: [() => fetchNekosBest('dance'), () => fetchKawaii('dance'), () => fetchOtaku('dance')],
    disappear: [() => fetchKawaii('disappear'), () => fetchNekosBest('run'), () => fetchOtaku('run')],
    dodge: [() => fetchKawaii('dodge'), () => fetchNekosBest('spin'), () => fetchOtaku('run')],
    facedesk: [() => fetchKawaii('facedesk'), () => fetchNekosBest('facepalm'), () => fetchOtaku('facepalm')],
    facepalm: [() => fetchOtaku('facepalm'), () => fetchNekosBest('facepalm'), () => fetchKawaii('facepalm')],
    headbang: [() => fetchOtaku('headbang'), () => fetchNekosBest('dance'), () => fetchKawaii('dance')],
    hide: [() => fetchKawaii('hide'), () => fetchNekosBest('lurk'), () => fetchOtaku('run')],
    money: [() => fetchKawaii('money'), () => fetchNekosBest('happy'), () => fetchOtaku('celebrate')],
    nom: [() => fetchNekosBest('nom'), () => fetchKawaii('nom'), () => fetchOtaku('nom')],
    peek: [() => fetchOtaku('peek'), () => fetchKawaii('peek'), () => fetchNekosBest('lurk')],
    purr: [() => fetchKawaii('purr'), () => fetchNekosBest('wag'), () => fetchOtaku('happy')],
    roll: [() => fetchOtaku('roll'), () => fetchNekosBest('spin'), () => fetchKawaii('spin')],
    run: [() => fetchNekosBest('run'), () => fetchKawaii('run'), () => fetchOtaku('run')],
    salute: [() => fetchNekosBest('salute'), () => fetchKawaii('salute'), () => fetchOtaku('cheers')],
    shrug: [() => fetchNekosBest('shrug'), () => fetchKawaii('shrug'), () => fetchOtaku('shrug')],
    sigh: [() => fetchOtaku('sigh'), () => fetchNekosBest('yawn'), () => fetchKawaii('sleepy')],
    sip: [() => fetchNekosBest('sip'), () => fetchKawaii('sip'), () => fetchOtaku('sip')],
    sit: [() => fetchKawaii('sit'), () => fetchNekosBest('sleep'), () => fetchOtaku('sleep')],
    sleep: [() => fetchNekosBest('sleep'), () => fetchKawaii('sleepy'), () => fetchOtaku('sleep')],
    sleepy: [() => fetchKawaii('sleepy'), () => fetchNekosBest('sleep'), () => fetchOtaku('sleep')],
    spin: [() => fetchNekosBest('spin'), () => fetchKawaii('spin'), () => fetchOtaku('dance')],
    stare: [() => fetchNekosBest('stare'), () => fetchKawaii('stare'), () => fetchOtaku('stare')],

    
    alarm: [() => fetchKawaii('alarm'), () => fetchNekosBest('shocked'), () => fetchOtaku('surprised')],
    angrystare: [() => fetchOtaku('angrystare'), () => fetchNekosBest('angry'), () => fetchKawaii('mad')],
    ask: [() => fetchKawaii('ask'), () => fetchNekosBest('think'), () => fetchOtaku('confused')],
    baka: [() => fetchNekosBest('baka'), () => fetchKawaii('baka'), () => fetchOtaku('mad')],
    blyat: [() => fetchKawaii('blyat'), () => fetchNekosBest('angry'), () => fetchOtaku('mad')],
    celebrate: [() => fetchOtaku('celebrate'), () => fetchKawaii('party'), () => fetchNekosBest('happy')],
    coffee: [() => fetchKawaii('coffee'), () => fetchNekosBest('sip'), () => fetchOtaku('sip')],
    comfy: [() => fetchPurr('comfy/gif'), () => fetchNekosBest('sleep'), () => fetchKawaii('sleepy')],
    error: [() => fetchKawaii('error'), () => fetchNekosBest('confused'), () => fetchOtaku('confused')],
    no: [() => fetchOtaku('no'), () => fetchNekosBest('nope'), () => fetchKawaii('confused')],
    ok: [() => fetchKawaii('ok'), () => fetchNekosBest('thumbsup'), () => fetchOtaku('thumbsup')],
    scream: [() => fetchKawaii('scream'), () => fetchOtaku('shout'), () => fetchNekosBest('shocked')],
    shame: [() => fetchKawaii('shame'), () => fetchNekosBest('facepalm'), () => fetchOtaku('facepalm')],
    slowclap: [() => fetchOtaku('slowclap'), () => fetchNekosBest('clap'), () => fetchKawaii('clap')],
    smoke: [() => fetchKawaii('smoke'), () => fetchOtaku('cool'), () => fetchNekosBest('smug')],
    sneeze: [() => fetchOtaku('sneeze'), () => fetchNekosBest('confused'), () => fetchKawaii('confused')],
    sorry: [() => fetchOtaku('sorry'), () => fetchNekosBest('pout'), () => fetchKawaii('pout')],
    stop: [() => fetchOtaku('stop'), () => fetchNekosBest('nope'), () => fetchKawaii('ok')],
    thumbsup: [() => fetchNekosBest('thumbsup'), () => fetchOtaku('thumbsup'), () => fetchKawaii('ok')],
    tired: [() => fetchOtaku('tired'), () => fetchNekosBest('yawn'), () => fetchKawaii('sleepy')],
    triggered: [() => fetchKawaii('triggered'), () => fetchNekosBest('angry'), () => fetchOtaku('mad')],
    wave: [() => fetchNekosBest('wave'), () => fetchKawaii('wave'), () => fetchOtaku('wave')],
    wink: [() => fetchNekosBest('wink'), () => fetchKawaii('wink'), () => fetchOtaku('wink')],
    woah: [() => fetchOtaku('woah'), () => fetchNekosBest('shocked'), () => fetchKawaii('shocked')],
    yawn: [() => fetchNekosBest('yawn'), () => fetchOtaku('yawn'), () => fetchKawaii('sleepy')],

    
    cute: [() => fetchKawaii('cute'), () => fetchNekosBest('happy'), () => fetchOtaku('happy')],
    destroy: [() => fetchKawaii('destroy'), () => fetchNekosBest('punch'), () => fetchOtaku('punch')],
    die: [() => fetchKawaii('die'), () => fetchNekosBest('cry'), () => fetchOtaku('sad')],
    eevee: [() => fetchPurr('eevee/gif'), () => fetchNekosBest('kitsune')],
    fbi: [() => fetchKawaii('fbi'), () => fetchNekosBest('shoot'), () => fetchOtaku('scared')],
    kill: [() => fetchKawaii('kill'), () => fetchNekosBest('shoot'), () => fetchOtaku('punch')],
    neko: [() => fetchPurr('neko/gif'), () => fetchNekosBest('neko')],
    party: [() => fetchKawaii('party'), () => fetchOtaku('celebrate'), () => fetchNekosBest('happy')],
    puke: [() => fetchKawaii('puke'), () => fetchNekosBest('confused'), () => fetchOtaku('confused')],
    pusheen: [() => fetchKawaii('pusheen'), fetchCat, () => fetchNekosBest('happy')],
    stomp: [() => fetchKawaii('stomp'), () => fetchNekosBest('kick'), () => fetchOtaku('mad')],
    tail: [() => fetchPurr('tail/gif'), () => fetchNekosBest('wag')],
    trap: [() => fetchKawaii('trap'), () => fetchNekosBest('confused')],
    uwu: [() => fetchKawaii('uwu'), () => fetchNekosBest('blush'), () => fetchOtaku('love')],
    wasted: [() => fetchKawaii('wasted'), () => fetchNekosBest('confused')],
    wiggle: [() => fetchKawaii('wiggle'), () => fetchNekosBest('dance'), () => fetchOtaku('dance')],
    yay: [() => fetchOtaku('yay'), () => fetchNekosBest('happy'), () => fetchKawaii('happy')],
    yeet: [() => fetchNekosBest('yeet'), () => fetchKawaii('yeet'), () => fetchNekosBest('kick')],
    yes: [() => fetchOtaku('yes'), () => fetchNekosBest('nod'), () => fetchKawaii('ok')]
};

for (const [name, providers] of Object.entries(sfwGifFallbacks)) {
    mediacord.gifs.sfw[name] = createFallbackRunner(name, providers);
}

const sfwImageFallbacks = {
    neko: [() => fetchNekosBest('neko'), () => fetchNekoBot('neko')],
    waifu: [() => fetchNekosBest('waifu'), () => fetchNekosBest('kitsune')],
    shinobu: [() => fetchNekosBest('waifu')],
    megumin: [() => fetchNekosBest('waifu')],
    cat: [fetchCat, () => fetchNekoBot('cat')],
    dog: [fetchDog, () => fetchNekoBot('dog')],
    food: [() => fetchNekoBot('food'), () => fetchNekosBest('feed')],
    senko: [() => fetchPurr('senko/img'), () => fetchNekosBest('kitsune')],
    kanna: [() => fetchNekoBot('kanna'), () => fetchNekosBest('waifu')],
    kitsune: [() => fetchNekosBest('kitsune'), () => fetchPurr('kitsune/img')],
    background: [() => fetchPurr('background/img'), () => fetchNekosBest('waifu')],
    holo: [() => fetchPurr('holo/img'), () => fetchNekosBest('kitsune')],
    awoo: [() => fetchNekosBest('kitsune'), () => fetchPurr('kitsune/img')],
    coffee: [() => fetchNekoBot('coffee'), () => fetchNekosBest('sip')],
    icon: [() => fetchPurr('icon/img'), () => fetchNekosBest('waifu')],
    okami: [() => fetchPurr('okami/img'), () => fetchNekosBest('kitsune')],
    eevee: [() => fetchPurr('eevee/img'), () => fetchNekosBest('kitsune')],
    kemonomimi: [() => fetchNekoBot('kemonomimi'), () => fetchNekosBest('kitsune')],
    anime: [() => fetchNekosBest('waifu')]
};

for (const [name, providers] of Object.entries(sfwImageFallbacks)) {
    mediacord.images.sfw[name] = createFallbackRunner(name, providers);
}

if (mediacord.gifs.satou_sfw) {
    const satouReplacements = {
        angry: [() => fetchNekosBest('angry')],
        bite: [() => fetchNekosBest('bite'), () => fetchKawaii('bite')],
        bored: [() => fetchNekosBest('bored')],
        bread: [() => fetchNekoBot('food')],
        chocolate: [() => fetchNekoBot('food')],
        cookie: [() => fetchNekoBot('food')],
        cuddle: [() => fetchNekosBest('cuddle'), () => fetchKawaii('cuddle')],
        dance: [() => fetchNekosBest('dance'), () => fetchKawaii('dance')],
        drunk: [() => fetchKawaii('confused')],
        happy: [() => fetchNekosBest('happy'), () => fetchKawaii('happy')],
        kill: [() => fetchKawaii('kill'), () => fetchNekosBest('shoot')],
        kiss: [() => fetchNekosBest('kiss'), () => fetchKawaii('kiss')],
        laugh: [() => fetchNekosBest('laugh'), () => fetchKawaii('laugh')],
        lick: [() => fetchKawaii('lick'), () => fetchOtaku('lick')],
        lonely: [() => fetchKawaii('lonely')],
        pat: [() => fetchNekosBest('pat'), () => fetchKawaii('pat')],
        poke: [() => fetchNekosBest('poke'), () => fetchKawaii('poke')],
        pregnant: [() => fetchNekosBest('waifu')],
        punch: [() => fetchNekosBest('punch'), () => fetchKawaii('punch')],
        run: [() => fetchNekosBest('run'), () => fetchKawaii('run')],
        slap: [() => fetchNekosBest('slap'), () => fetchKawaii('slap')],
        sleep: [() => fetchNekosBest('sleep'), () => fetchOtaku('sleep')],
        spank: [() => fetchNekosBest('slap')],
        spit: [() => fetchKawaii('mad')],
        steal: [() => fetchKawaii('money')],
        tickle: [() => fetchNekosBest('tickle'), () => fetchKawaii('tickle')],
        nomm: [() => fetchNekosBest('nom'), () => fetchKawaii('nom')]
    };

    for (const [name, providers] of Object.entries(satouReplacements)) {
        mediacord.gifs.satou_sfw[name] = createFallbackRunner(name, providers);
    }
}

module.exports = mediacord;
