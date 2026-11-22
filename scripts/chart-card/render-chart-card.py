#!/usr/bin/env python3
"""Make one day's chart-fact post for Tempify's Instagram.

    python3 render-chart-card.py posts/2026-11-24

The folder holds post.json, which names the song (README.md has the fields), and can be
anywhere. This finds the song in Tempify's Hot 100 index (src/assets/hot-100-songs.json in this
repo), so no chart number ever comes from memory, works out the answer letter and the artist's
biggest hit, looks up the record's cover, and writes into the same folder:

    reel.mp4               the Reel: 1080 by 1920, under 20 seconds, with a voice reading it and
                           the app's sounds under it. Instagram adds the song itself from its own
                           music library when the bot posts it.
    reel-cover.jpg         the Reel's cover, the question with every letter in
    1.jpg  2.jpg  3.jpg    the same three as pictures for a post, 1080 by 1350. JPEG, since
                           that's the only kind Instagram's API takes.
    art.jpg                the record's cover from the Cover Art Archive, when there is one
    caption.txt            the caption, with no answer in it
    poll.json              the poll's four choices, the way Instagram's poll_attachment takes them
    facts.json             what the post says and the voice reads, answer letter included

It stops with a plain message when the song isn't in the index, rather than guess. --index <path>
reads another copy of the index.

How the Reel is made: tempify-chart-card.html is the whole template, with the words the voice
says, when everything happens, the motion and the sounds. This speaks the template's lines with
Ming-3.0-tts, a voice model that runs on this Mac, in the voice of voice.wav, tells the page how
long each one took, then has Chrome lay out each frame (seek) and ffmpeg join them with the voice
and the sounds. The pictures are drawn at twice the size and brought down, which keeps the words
sharp.

Needs Google Chrome, ffmpeg (brew install ffmpeg) and its own Python packages, set up once (the
README has the line). The voice model itself, about 3 GB, comes down by itself on the first run.
Written November 2, 2026; the Reel moved and talked from November 3, and Ming took over the voice
from Kokoro on November 18.
"""
import base64
import io
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import unicodedata
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote
from urllib.error import HTTPError
from urllib.request import Request, pathname2url, urlopen

HERE = Path(__file__).resolve().parent
VENV = Path.home() / ".venvs" / "tempify-chart-card"
SETUP = f"python3 -m venv {VENV} && {VENV}/bin/pip install -r {HERE / 'requirements.txt'}"

# The packages live in their own environment, so a plain "python3 render-chart-card.py" moves
# itself into it. The voice model's loaders print progress bars and warnings that mean nothing here.
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
try:
    import mlx.core as mx
    import numpy as np
    import onnxruntime
    import phonemizer
    import soundfile
    from huggingface_hub import snapshot_download
    from kokoro_onnx.tokenizer import Tokenizer
    from mlx_audio.tts.utils import load_model
    from PIL import Image, ImageCms
    from playwright.sync_api import sync_playwright
    from scipy.signal import resample_poly
except ImportError:
    if (VENV / "bin" / "python").exists() and Path(sys.prefix).resolve() != VENV.resolve():
        os.execv(VENV / "bin" / "python", [str(VENV / "bin" / "python"), "-I", str(Path(__file__).resolve()), *sys.argv[1:]])
    raise SystemExit(f"\nThe chart card needs its Python packages. Set them up once with:\n  {SETUP}\n")

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CARD = HERE / "tempify-chart-card.html"
SOUNDS = HERE.parent.parent / "public" / "sounds"
POST, REEL, SCALE, FPS = (1080, 1350), (1080, 1920), 2, 30
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()

# The voice: Ming-3.0-tts 0.5B (Ant Group, MIT license) speaking in the voice it copies from
# voice.wav, Kokoro's af_heart at 1.2 reading VOICE_SAYS. Jett picked it on November 18, 2026,
# over Kokoro reading for itself and over Phonon's Hadley ("a bit too nasally") and Ming's own
# US_Emma ("too sharp"). Kokoro needed the t softened in twenty, seventy and ninety (11/3), the
# stress moved onto "teen" so thirteen wasn't "thirdeen" (11/8), and "A, B, C, or D?" recorded,
# since it ran the letters together (11/4). Ming reads the words as written and got all of those
# right by itself, at about af_heart's pace, which it takes from voice.wav too.
VOICE = HERE / "voice.wav"
VOICE_SAYS = ("Every day we pick a song from yesterday's game and ask where it peaked on the chart. "
              "Vote in the poll, and the answer comes right after the countdown.")
VOICE_MODEL = "mlx-community/Ming-3.0-tts-0.5B-bf16"
VOICE_VERSION = "283b3c342c6fb69a7a87832c97f9799567efe05d"  # held to one version, so the voice can't change under us
VOICE_RATE = 44100

FIRST_DAY = date(2026, 4, 28)  # Tempify's day #1, as in src/lib/date.js
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]

# The four letters, as on the dial in the HTML and in the poll.
ZONES = [("A", "Top 10"), ("B", "#11 to #40"), ("C", "#41 to #100"), ("D", "Never charted")]

# MusicBrainz asks every caller to name itself.
AGENT = "TempifyChartCard/1.0 ( https://tempify.me )"

# With the poll, Instagram shows the caption as the poll's question, so it leads with it.
CAPTION_POLL = """Where did “{song}” by {artist} peak on the Hot 100? Vote, then see the answer.

It was one of the songs in yesterday's Hit or Miss. Today's are up at tempify.me (link in bio).

#hot100 #musictrivia #{tag}"""

CAPTION = """Where did “{song}” by {artist} peak on the Hot 100?

A. Top 10
B. #11 to #40
C. #41 to #100
D. Never charted

Comment your letter, then swipe for the answer.

It was one of the songs in yesterday's Hit or Miss. Today's are up at tempify.me (link in bio).

#hot100 #musictrivia #{tag}"""


def fail(message):
    raise SystemExit(f"\n{message}\n")


def norm(text):
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[’'`]", "", text)
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def find_index(argv):
    if "--index" in argv:
        return Path(argv[argv.index("--index") + 1]).expanduser()
    return HERE.parent.parent / "src" / "assets" / "hot-100-songs.json"


def look_up(rows, post):
    """The index row for the post's song, or None when it never charted."""
    title = norm(post.get("index_title") or post["song"])
    artist = norm(post["artist"])

    def by_artist(row):
        return re.search(rf"\b{re.escape(artist)}\b", norm(row[1])) is not None

    hits = [r for r in rows if norm(r[0]) == title and by_artist(r)]
    if not hits:
        # A longer title in the index: "Sweet Caroline (Good Times Never Seemed So Good)".
        hits = [r for r in rows if "(" in r[0] and norm(r[0].split("(")[0]) == title and by_artist(r)]
    hits.sort(key=lambda r: (r[2], -r[4], -r[3]))

    if post.get("never_charted"):
        if hits:
            r = hits[0]
            fail(f"post.json says it never charted, but the index has {r[0]} by {r[1]} at #{r[2]}.\n"
                 "Take never_charted out, or pick another song.")
        return None
    if not hits:
        theirs = sorted({r[0] for r in rows if by_artist(r)})
        listed = "\n  ".join(theirs[:40]) or "(nothing by that artist either)"
        fail(f"{post['song']} by {post['artist']} isn't in the Hot 100 index.\n"
             f"If the index has it under a longer name, set index_title in post.json. "
             f"If it really never charted, set \"never_charted\": true.\n"
             f"What the index has by {post['artist']}:\n  {listed}")
    return hits[0]


def weeks(n, what):
    return f"{n} week{'' if n == 1 else 's'} {what}"


def facts_for(row, post):
    if row is None:
        return f"Released in {post['year']}" if post.get("year") else ""
    first = date.fromisoformat(row[5])
    since = f"First charted {MONTHS[first.month - 1]} {first.year}."
    if row[2] == 1:
        return f"{weeks(row[4], 'at #1')}. {since}"
    return f"{weeks(row[3], 'on the chart')}. {since}"


def biggest_for(rows, row, post):
    """The artist's own biggest hit, when it did better than this song. Credits shared with
    someone else don't count, so "Queen's biggest" means Queen alone."""
    artist = norm(post["artist"])
    theirs = [r for r in rows if norm(r[1]) == artist and r is not row]
    if not theirs:
        return None
    best = min(theirs, key=lambda r: (r[2], -r[4], -r[3]))
    if row is not None and best[2] >= row[2]:
        return None
    detail = f"#1 for {best[4]} week{'' if best[4] == 1 else 's'}" if best[2] == 1 else f"#{best[2]}"
    return {"artist": post["artist"], "title": best[0], "detail": detail, "peak": best[2], "weeksAt1": best[4]}


def missed_for(rows, post, biggest):
    """For a song that never charted, the most surprising thing the index says about its artist,
    for the voice to say after "It never charted!" (the page words it). On 11/8/2026 Jett said
    "it came out in ninety-four" was no payoff, and "even though it came out in" before it said the
    song should have been a hit that year. In order: another of theirs that charted the same year,
    a long wait since their last one, their first one coming later, or how many they had. Credits
    shared with someone else don't count, as with the biggest hit."""
    artist = norm(post["artist"])
    theirs = [r for r in rows if norm(r[1]) == artist]
    if not theirs:
        return {"kind": "none"}
    year = int(post["year"]) if post.get("year") else None
    charted = lambda r: int(r[5][:4])
    if year:
        same = [r for r in theirs if charted(r) == year]
        if same:
            best = min(same, key=lambda r: (r[2], -r[4], -r[3]))
            # Said aloud, so a trailing "(Part 1)" or a cut-off subtitle is left out.
            title = re.sub(r"\s*\([^)]*\)?\s*$", "", best[0]) or best[0]
            return {"kind": "same", "title": title,
                    "biggest": bool(biggest) and biggest["title"] == best[0]}
        before = [charted(r) for r in theirs if charted(r) < year]
        if before and year - max(before) >= 5:
            return {"kind": "gap", "years": year - max(before)}
        if not before:
            return {"kind": "first", "years": min(charted(r) for r in theirs) - year}
    return {"kind": "count", "songs": len(theirs)}


def answer_letter(peak):
    if peak is None:
        return "D"
    return "A" if peak <= 10 else "B" if peak <= 40 else "C"


def tls():
    """python.org's Python on a Mac ships without certificates until someone runs its installer
    step, so fall back to the ones macOS keeps."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    if Path("/etc/ssl/cert.pem").exists():
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


def fetch(url, timeout=20):
    request = Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    with urlopen(request, timeout=timeout, context=tls()) as res:
        return res.read()


def search(kind, query):
    # MusicBrainz turns away a second request within the same second, so wait and ask again.
    for attempt in range(4):
        try:
            return json.loads(fetch(f"https://musicbrainz.org/ws/2/{kind}?fmt=json&limit=100&query=" + quote(query)))
        except HTTPError as e:
            if e.code != 503 or attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))


def credited(credits, who):
    """Whether a MusicBrainz credit names the artist, and isn't a various-artists record."""
    name = norm(" ".join(c.get("name", "") + " " + c.get("joinphrase", "") for c in credits or []))
    return bool(re.search(rf"\b{re.escape(who)}\b", name)) and "various artists" not in name


def release_groups(post):
    """MusicBrainz release groups to take the cover from, best first. A Hot 100 hit came out as a
    single, so its single leads. Then the artist's own studio albums with the song, oldest first,
    which is the only record a song that never charted has. Greatest hits, live albums and
    various-artists records are left out, so none of them stands in for the record."""
    if post.get("art_release_group"):
        return [post["art_release_group"]]
    song, artist = post["song"], post["artist"]
    want, who = norm(song), norm(artist)

    # A two-sided single is named for both: "Hey Jude / Revolution".
    sides = lambda title: [norm(side) for side in title.split(" / ")]
    found = search("release-group", f'releasegroup:"{song}" AND artist:"{artist}" AND primarytype:single')
    singles = [g for g in found.get("release-groups", [])
               if g.get("score", 0) >= 90 and want in sides(g.get("title", ""))
               and not g.get("secondary-types") and credited(g.get("artist-credit"), who)]
    singles.sort(key=lambda g: g.get("first-release-date") or "9999")

    time.sleep(1.1)  # MusicBrainz takes one request a second
    found = search("recording", f'recording:"{song}" AND artist:"{artist}" AND primarytype:album AND status:official')
    albums = {}
    for rec in found.get("recordings", []):
        if rec.get("score", 0) < 90 or norm(rec.get("title", "")) != want:
            continue
        for rel in rec.get("releases", []):
            group = rel.get("release-group", {})
            if (rel.get("status") != "Official" or group.get("primary-type") != "Album"
                    or group.get("secondary-types") or not credited(rel.get("artist-credit"), who)):
                continue
            day = rel.get("date") or "9999"
            albums[group["id"]] = min(day, albums.get(group["id"], day))

    picks = [g["id"] for g in singles] + sorted(albums, key=albums.get)
    return list(dict.fromkeys(picks))[:6]


def find_art(post, folder):
    """The record's front cover from the Cover Art Archive, saved as art.jpg. The covers belong to
    their labels; the archive adds no terms of its own. Returns the release group used, or None
    when there's no cover to show (the answer then shows without one)."""
    if post.get("art") is False:
        return None
    try:
        groups = release_groups(post)
    except Exception as e:  # MusicBrainz down or slow: go on without a cover
        print(f"No cover: MusicBrainz didn't answer ({e}).")
        return None
    for group in groups:
        try:
            image = fetch(f"https://coverartarchive.org/release-group/{group}/front-500", timeout=30)
            Image.open(io.BytesIO(image)).convert("RGB").save(folder / "art.jpg", "JPEG", quality=92)
            return group
        except Exception:
            continue
    print("No cover found. The answer shows without one.")
    return None


def card_url(data, query):
    return CARD.as_uri() + query + "#" + quote(json.dumps(data))


def open_card(browser, data, query, size, scale=1):
    """The template in a page of its own, filled in and ready to be taken."""
    page = browser.new_context(viewport={"width": size[0], "height": size[1]}, device_scale_factor=scale).new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(card_url(data, query))
    try:
        page.wait_for_function("window.cardReady === true", timeout=30000)
    except Exception:
        fail("The template didn't finish drawing." + (f" It said:\n{errors[0]}" if errors else ""))
    return page


def picture(browser, data, query, size):
    """One picture, drawn at twice the size and brought down."""
    page = open_card(browser, data, query, size, SCALE)
    big = Image.open(io.BytesIO(page.screenshot(type="png")))
    page.context.close()
    if big.size != (size[0] * SCALE, size[1] * SCALE):
        fail(f"Chrome drew {big.size}")
    return big.convert("RGB").resize(size, Image.LANCZOS)


def save_jpeg(image, path):
    # Full color detail (no subsampling) keeps the thin blue type clean.
    image.save(path, "JPEG", quality=92, subsampling=0, icc_profile=SRGB, optimize=True)


def voice_model():
    """Ming, fetched once into ~/.cache/huggingface at the version above, and read from there after."""
    try:
        path = snapshot_download(VOICE_MODEL, revision=VOICE_VERSION, local_files_only=True)
    except Exception:
        print("Getting the voice model once, into ~/.cache/huggingface (about 3 GB; this takes a few minutes).")
        path = snapshot_download(VOICE_MODEL, revision=VOICE_VERSION)
    model = load_model(path)
    if model.sample_rate != VOICE_RATE:
        fail(f"The voice model talks at {model.sample_rate} Hz, not the {VOICE_RATE} this expects.")
    return model


# Ming reads digits badly ("17 weeks" came out "shisty weeks"), so every number is written out for
# it the way it's said. A year in a title is said like one: "1999" is "nineteen ninety-nine".
ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
        "fifteen sixteen seventeen eighteen nineteen").split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def spell(n):
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("-" + ONES[n % 10] if n % 10 else "")
    if n < 1000:
        return ONES[n // 100] + " hundred" + (" " + spell(n % 100) if n % 100 else "")
    return spell(n // 1000) + " thousand" + (" " + spell(n % 1000) if n % 1000 else "")


def say_number(digits):
    n = int(digits)
    if len(digits) == 4 and 1100 <= n <= 2099 and not 2000 <= n <= 2009:
        hi, lo = divmod(n, 100)
        return spell(hi) + " " + (spell(lo) if lo >= 10 else f"oh {ONES[lo]}" if lo else "hundred")
    return spell(n)


# "feat." is said "featuring" (Jett, 11/21/2026: "Say feat as featuring"); Ming reads it "feet".
FEATURING = re.compile(r"\b(?:feat|ft)\.(?=\s)|(?<=\()(?:feat|ft)\b(?=\s)", re.I)


def words_for(text):
    """The line as the voice is given it: the same, with "feat." as "featuring" and its numbers
    written out."""
    return re.sub(r"\d+", lambda m: say_number(m.group()), FEATURING.sub("featuring", text))


def trimmed(audio, rate):
    """The line without the quiet Ming leaves before and after it, which would otherwise count as
    talking when the page times the Reel."""
    hop = rate // 100
    frames = len(audio) // hop
    loud = np.sqrt(np.mean(audio[:frames * hop].reshape(frames, hop) ** 2, axis=1))
    on = np.flatnonzero(loud > loud.max() * 10 ** (-45 / 20))
    return audio[max(0, (on[0] - 2) * hop):min(len(audio), (on[-1] + 4) * hop)]


# "A? B? C? Or D?" asks each letter, which Ming says well but slowly (about 2.5 seconds), so the
# pauses between the letters are cut to this long. The letters themselves are left as she says
# them. 0.18 s makes it about 2 seconds, as long as the recording it replaced.
LETTER_PAUSE = 0.18


def tightened(audio, rate, longest):
    """The line with every pause inside it cut to `longest` seconds, and a 5 ms fade at each join."""
    hop = rate // 100
    frames = len(audio) // hop
    loud = np.sqrt(np.mean(audio[:frames * hop].reshape(frames, hop) ** 2, axis=1))
    quiet = loud < loud.max() * 10 ** (-35 / 20)
    keep, fade = round(longest * 100), int(0.005 * rate)
    pieces, start, i = [], 0, 0
    while i < frames:
        j = i
        while j < frames and quiet[j]:
            j += 1
        if j - i > keep and i > 0 and j < frames:
            piece = audio[start:(i + keep // 2) * hop].copy()
            piece[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
            pieces.append(piece)
            start = (j - (keep - keep // 2)) * hop
        i = max(j, i + 1)
    rest = audio[start:].copy()
    if pieces:
        rest[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
    return np.concatenate(pieces + [rest])


# ------------------------------------------------------------------------------------ the ear
#
# Ming says a name its own way from one line to the next and from one take to the next. On
# 11/22/2026 Jett sent back Aaliyah said wrong in the first line and right in the "biggest" line,
# Gunna right in the first and wrong in the "biggest" line, the "Bout" of "Bout A Million" as
# "boot", and "Luvin", a respelling espeak reads right, as "loo-vin". Nothing listened to Ming
# before then: respellings were checked with espeak, which is not the voice. Speech recognition
# that knows words can't hear these either, since it hears the word it expects. This ear knows no
# words: wav2vec2 taught to write down espeak's phonemes for Common Voice (Meta, Apache 2.0), run
# through onnxruntime, so "boot" comes back as b uː t. Tried on those send-backs it heard what
# Jett heard in all seven lines, and another seed or a respelling it heard as right was right.
EAR_MODEL = "onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX"
EAR_VERSION = "c69750f5043e5e1f8a71ab95dd3b98338c280c92"  # held to one version, as the voice is
EAR_FILES = ["vocab.json", "onnx/model.onnx"]


def ear():
    """The recognizer and its sounds by number, fetched once (about 1.3 GB) into the same cache."""
    try:
        path = Path(snapshot_download(EAR_MODEL, revision=EAR_VERSION, allow_patterns=EAR_FILES,
                                      local_files_only=True))
        if not all((path / f).exists() for f in EAR_FILES):
            raise FileNotFoundError
    except Exception:
        print("Getting the ear once, into ~/.cache/huggingface (about 1.3 GB).")
        path = Path(snapshot_download(EAR_MODEL, revision=EAR_VERSION, allow_patterns=EAR_FILES))
    vocab = {n: s for s, n in json.loads((path / "vocab.json").read_text()).items()}
    session = onnxruntime.InferenceSession(str(path / "onnx" / "model.onnx"), providers=["CPUExecutionProvider"])
    return session, vocab


def heard(listener, audio):
    """The sounds the ear hears in a take, in the same symbols sounds_in gives."""
    session, vocab = listener
    x = resample_poly(audio, 160, 441)  # Ming's 44.1 kHz to the ear's 16
    x = ((x - x.mean()) / (x.std() + 1e-7)).astype(np.float32)[None]
    ids = session.run(None, {session.get_inputs()[0].name: x})[0][0].argmax(-1)
    out, last = [], -1
    for n in ids:
        if n != last and not vocab[int(n)].startswith("<"):
            out += [s for s, _, _ in sounds_in(vocab[int(n)])]
        last = n
    return out


# IPA, from espeak or from Claude, as single sounds: "aɪ" or "tʃ" is one, the r in "ɑːɹ" is its own.
PAIRS = ("aɪ", "aʊ", "eɪ", "oʊ", "ɔɪ", "tʃ", "dʒ")
SAME_SOUND = {"r": "ɹ", "ɫ": "l", "g": "ɡ", "ɝ": "ɚ", "ɜ": "ɚ", "ɜː": "ɚ", "ʤ": "dʒ", "ʧ": "tʃ",
              "ɒ": "ɑ", "ɒː": "ɑː"}
VOWEL = set("aeiouyæɑɐɒɔəɘɚɛɜɞɤɪʊʌᵻɨʉøœɵ")
REDUCED = {"ə", "ɐ", "ᵻ"}  # what an unstressed vowel turns into in ordinary speech
STRESS = {"ˈ": 2.0, "ˌ": 1.5}  # how much a vowel under it counts, against 1 for any other sound


def sounds_in(ipa):
    """[(sound, weight, word)] for an IPA string, word counting the words from 0. A vowel under ˈ
    weighs 2, since a wrong vowel or a wrong stress is what a listener hears first; every other
    sound weighs 1."""
    ipa = unicodedata.normalize("NFC", ipa.replace(":", "ː").replace("'", "ˈ"))
    out, stress, word, i = [], 1.0, 0, 0
    while i < len(ipa):
        c = ipa[i]
        if c.isspace():
            word += bool(out) and out[-1][2] == word
            i += 1
            continue
        if c in STRESS:
            stress, i = STRESS[c], i + 1
            continue
        if not c.isalpha():
            i += 1
            continue
        s = ipa[i:i + 2] if ipa[i:i + 2] in PAIRS else c
        i += len(s)
        while i < len(ipa) and (ipa[i] in "ːʲ" or unicodedata.category(ipa[i]) == "Mn"):
            s, i = s + ipa[i], i + 1
        s = SAME_SOUND.get(s, s)
        vowel = any(ch in VOWEL for ch in s)
        out.append((s, stress if vowel else 1.0, word))
        if vowel:
            stress = 1.0
    return out


_espeak = []


def espeak(text):
    """How espeak reads a piece of a line (American English), as sounds_in gives it."""
    if not _espeak:
        _espeak.append(Tokenizer())  # sets up the espeak-ng that kokoro-onnx carries
    text = words_for(text).strip()
    return sounds_in(phonemizer.phonemize(text, "en-us", with_stress=True)) if text else []


# Sounds a listener takes for each other, or nearly, and what swapping one for the other costs
# (any other swap is 1). Unstressed vowels drift toward "uh" in ordinary speech, and a t or d
# between vowels is a flap, so those cost little; i against ɪ ("gimmee" against "gimmeh") or
# aʊ against uː ("bout" against "boot") cost most or all of the sound.
NEAR = {frozenset(pair): cost for pair, cost in [
    (("ə", "ɐ"), 0.1), (("ə", "ʌ"), 0.2), (("ɐ", "ʌ"), 0.2), (("ə", "ᵻ"), 0.2), (("ɪ", "ᵻ"), 0.2),
    (("ə", "ɪ"), 0.4), (("ə", "ɚ"), 0.4), (("ə", "ʊ"), 0.5), (("ɐ", "ɑ"), 0.6), (("ɪ", "i"), 0.8),
    (("ɪ", "ɛ"), 0.5), (("ɛ", "e"), 0.2), (("e", "eɪ"), 0.2), (("ɛ", "eɪ"), 0.5), (("ɛ", "æ"), 0.5),
    (("æ", "a"), 0.3), (("a", "ɑ"), 0.3), (("ɑ", "ɔ"), 0.3), (("ɑ", "ʌ"), 0.6), (("ʊ", "u"), 0.4),
    (("o", "oʊ"), 0.2), (("o", "ɔ"), 0.3), (("oʊ", "ɔ"), 0.6),
    (("t", "ɾ"), 0.2), (("d", "ɾ"), 0.2), (("t", "d"), 0.4), (("s", "z"), 0.3), (("f", "v"), 0.4),
    (("θ", "ð"), 0.3), (("ʃ", "ʒ"), 0.3), (("tʃ", "dʒ"), 0.3), (("k", "ɡ"), 0.4), (("p", "b"), 0.4),
    (("n", "ŋ"), 0.5), (("ɹ", "ɚ"), 0.4), (("j", "i"), 0.5), (("w", "u"), 0.5), (("t", "ʔ"), 0.3),
    (("θ", "t"), 0.6), (("ð", "d"), 0.6), (("m", "n"), 0.6)]}
LIGHT = {"ʔ": 0.2, "h": 0.5, "ə": 0.6, "ɐ": 0.6}  # a sound dropped or put in that's easy to miss


def swap_cost(meant, weight, said):
    """What hearing `said` for the meant sound costs, before its weight. The ear writes a vowel
    under stress long (iː) and a vowel out of it short or as "uh", the way espeak does, so on a
    stressed vowel the length is the stress: Aaliyah heard ɑː l i ə is AH-lee-uh, said wrong, and
    ɐ l iː ɐ is uh-LEE-uh, said right (11/22/2026). Off the stress, "uh" for a full vowel is just
    ordinary speech."""
    if meant == said:
        return 0.0
    a, b = meant.replace("ː", ""), said.replace("ː", "")
    vowel = any(ch in VOWEL for ch in a)
    if a == b:
        return 0.5 if weight > 1 else 0.1
    # Not the "ee" at the end of "Gimme", though: "gim-muh" was what Jett sent back (11/21/2026).
    if vowel and weight == 1 and said in REDUCED and a not in ("i", "u"):
        return min(0.2, NEAR.get(frozenset((a, b)), 1.0))
    return NEAR.get(frozenset((a, b)), 1.0)


def misses(meant, said):
    """Lines the heard sounds up with the meant ones (the fewest, cheapest changes) and says what
    each meant sound cost: miss[i] for the sound itself, said wrong or not said, weighted, and
    extra[i] for sounds heard that weren't meant, just before meant sound i (extra[n] after the
    last)."""
    n, m = len(meant), len(said)
    swap = lambda i, j: meant[i][1] * swap_cost(meant[i][0], meant[i][1], said[j])
    drop = lambda i: meant[i][1] * LIGHT.get(meant[i][0], 1.0)
    add = lambda j: LIGHT.get(said[j], 1.0)
    dist = np.zeros((n + 1, m + 1))
    dist[1:, 0] = np.cumsum([drop(i) for i in range(n)])
    dist[0, 1:] = np.cumsum([add(j) for j in range(m)])
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dist[i, j] = min(dist[i - 1, j - 1] + swap(i - 1, j - 1), dist[i - 1, j] + drop(i - 1),
                             dist[i, j - 1] + add(j - 1))
    miss, extra = [0.0] * n, [0.0] * (n + 1)
    i, j = n, m
    while i or j:
        if i and j and np.isclose(dist[i, j], dist[i - 1, j - 1] + swap(i - 1, j - 1)):
            miss[i - 1] = swap(i - 1, j - 1)
            i, j = i - 1, j - 1
        elif i and np.isclose(dist[i, j], dist[i - 1, j] + drop(i - 1)):
            miss[i - 1] = drop(i - 1)
            i -= 1
        else:
            extra[i] += add(j - 1)
            j -= 1
    return miss, extra


def line_meant(text, names):
    """The sounds a line should have, and where each word of each name is in them: espeak for the
    template's words, and each name the way it's meant. names: [(the name as the voice reads it,
    its meant sounds, its key)]. Returns (sounds, {key: [(start, end) of each word]})."""
    spots = []
    for said, sounds, key in sorted(names, key=lambda n: -len(n[0])):
        for m in re.finditer(rf"(?<![\w']){re.escape(said)}(?!\w)", text):
            if all(m.end() <= a or m.start() >= b for a, b, _, _ in spots):
                spots.append((m.start(), m.end(), sounds, key))
    spots.sort()
    meant, where, at = [], {}, 0
    for start, end, sounds, key in spots:
        meant += espeak(text[at:start])
        for w in sorted({s[2] for s in sounds}):
            word = [k for k, s in enumerate(sounds) if s[2] == w]
            where.setdefault(key, []).append((len(meant) + word[0], len(meant) + word[-1] + 1))
        meant += sounds
        at = end
        if text.startswith("'s", at):  # "Gunna's": the s after the name
            meant, at = meant + [("z", 1.0, -1)], at + 2
        elif text.startswith("'", at):
            at += 1
    return meant + espeak(text[at:]), where


def name_costs(meant, where, said):
    """How far off each name was, from 0 (said as meant) up: its worst word's cost, which is what
    its sounds cost, with anything extra heard inside or on either side of it, over how much its
    sounds weigh (at least 3, so "A" heard as ɐ for ə isn't a word said wrong). A word at a time,
    so one word said wrong in a long title ("Bout" in "Bout A Million") isn't lost among the ones
    said right."""
    miss, extra = misses(meant, said)
    word = lambda a, b: (sum(miss[a:b]) + sum(extra[a:b + 1])) / max(3, sum(s[1] for s in meant[a:b]))
    return {key: round(max(word(a, b) for a, b in spans), 3) for key, spans in where.items()}


# How far off a name may be (name_costs) and still be taken. A name whose sounds were given in
# post.json (from Jett's note, or the look) has to be close to them; one going by espeak's
# reading only has to be near it, since espeak gets names wrong too and Ming is often right
# where it isn't. A take is made again, up to NAME_TAKES seeds, until every name is within its
# bar, and the closest is kept when none is. A given name still further off than OFF in that
# take is flagged, so the card says to listen before posting. Set on Jett's send-backs of
# 11/19 to 11/22/2026: names he heard as right came to 0.08 or less, wrong ones 0.16 or more.
# GUESSED was 0.25 until Cher heard as "chair" (tʃ for ʃ, 0.25) got through on 12/2's card.
GIVEN, GUESSED, OFF = 0.12, 0.2, 0.15
NAME_TAKES = 6
SAY_KEYS = {"song": "saySong", "artist": "sayArtist", "biggest": "sayBiggest", "missed": "sayMissed"}

_takes = {}


def voiced(model, text, seed):
    """One take of a line, with its seed: the same line and seed come out the same every time."""
    if (text, seed) not in _takes:
        mx.random.seed(seed)
        _takes[text, seed] = trimmed(np.concatenate([np.array(part.audio, dtype=np.float32) for part in model.generate(
            text=words_for(text), ref_audio=str(VOICE), ref_text=VOICE_SAYS)]), VOICE_RATE)
    return _takes[text, seed]


def plain_quotes(text):
    return text.replace("’", "'").replace("‘", "'")


def said_in(name, text):
    return re.search(rf"(?<![\w']){re.escape(plain_quotes(name))}(?!\w)", text) is not None


def take(model, listener, text, names):
    """The take of a line to use, as (audio, seed, what the ear heard, {name key: how far off}).
    Now and then Ming runs on past a line or stops short of it, so a take far from the line's
    length is never used. A line with no name in it keeps the first take that isn't, as it always
    has; one with names (here: the names dicts said in it, each with "said", how the voice is given
    it) keeps the first whose names are all within their bars, or the closest."""
    count = len(words_for(text).split())
    best = None
    for seed in range(NAME_TAKES if names else 4):
        audio = voiced(model, text, seed)
        if not 0.12 * count <= len(audio) / VOICE_RATE <= 0.6 * count + 1:
            continue
        said = heard(listener, audio)
        if not names:
            return audio, seed, said, {}
        meant, where = line_meant(text, [(n["said"], n["meant"], n["key"]) for n in names])
        costs = name_costs(meant, where, said)
        score = max(costs.get(n["key"], 0) / n["bar"] for n in names)
        if best is None or score < best[0]:
            best = (score, audio, seed, said, costs)
        if score <= 1:
            break
    if best is None:
        fail(f'The voice couldn\'t say "{text}" at a sensible length in {NAME_TAKES if names else 4} tries.')
    return best[1:]


def names_for(post, data):
    """The names the voice says, each as a dict: key (song, artist, biggest, missed), name as
    written, tries (how to give it to the voice, best first: post.json's say_<key>, one spelling
    or a list, else the name as written), meant (its sounds: post.json's "sounds" for it, else
    espeak's reading) and bar (GIVEN or GUESSED)."""
    found = [("song", post["song"]), ("artist", post["artist"])]
    missed = data.get("missed") or {}
    if data.get("biggest") and not missed.get("biggest"):
        found.append(("biggest", data["biggest"]["title"]))
    if missed.get("title"):
        found.append(("missed", missed["title"]))
    out = []
    for key, name in found:
        say = post.get(f"say_{key}")
        tries = [plain_quotes(t) for t in ([say] if isinstance(say, str) else say or []) if t] or [plain_quotes(name)]
        given = (post.get("sounds") or {}).get(name)
        # Never espeak's reading of a respelling: it reads "Aliyah", which Ming says as
        # uh-LEE-uh, as AL-ih-yuh, and "Bowt" as "boat".
        meant = sounds_in(given) if given else espeak(name)
        out.append({"key": key, "name": name, "tries": tries, "meant": meant,
                    "bar": GIVEN if given else GUESSED})
    return out


def lines_for(page, picks):
    """The template's lines with these spellings for the names (picks: {key: spelling})."""
    return page.evaluate("p => { Object.assign(data, p); return voiceLines(); }",
                         {SAY_KEYS[k]: v for k, v in picks.items()})


def names_said(names, picks, text):
    """The names said in a line, each with "said", the spelling the voice is given."""
    return [{**n, "said": picks[n["key"]]} for n in names if said_in(picks[n["key"]], text)]


def pick_spellings(page, model, listener, names):
    """For each name with more than one spelling to try, the first that the voice says within its
    bar in every line it's in, or else the closest. Returns {key: spelling}."""
    picks = {n["key"]: n["tries"][0] for n in names}
    for n in names:
        if len(n["tries"]) < 2:
            continue
        best = None
        for spelling in n["tries"]:
            trial = {**picks, n["key"]: spelling}
            score = 0
            for line in lines_for(page, trial):
                here = names_said(names, trial, line["text"])
                if any(m["key"] == n["key"] for m in here):
                    score = max(score, take(model, listener, line["text"], here)[3].get(n["key"], 0) / n["bar"])
            if best is None or score < best[0]:
                best = (score, spelling)
            if score <= 1:
                break
        picks[n["key"]] = best[1]
    return picks


def speak(page, model, listener, names, picks):
    """Says each of the template's lines, with these spellings for the names. Returns the lines;
    each one's sound, and for the page how long it takes and, for the lines whose words land one
    at a time, when each word starts; and for facts.json what the ear heard in each line and how
    far off each name was."""
    spoken, heard_lines = {}, []
    lines = lines_for(page, picks)
    for line in lines:
        audio, seed, said, costs = take(model, listener, line["text"], names_said(names, picks, line["text"]))
        heard_lines.append({"key": line["key"], "said": line["text"], "heard": " ".join(said),
                            "take": seed, **({"names": costs} if costs else {})})
        if line["key"] == "options":
            audio = tightened(audio, VOICE_RATE, LETTER_PAUSE)
        info = {"dur": round(len(audio) / VOICE_RATE, 3)}
        if line.get("words"):
            info["words"] = word_starts(line["text"], audio, VOICE_RATE)
        spoken[line["key"]] = (audio, info)
    return lines, spoken, heard_lines


def word_starts(text, audio, rate):
    """When each word of a line starts. Ming doesn't say, so the line's time is shared out by how
    many letters each word has as it's said (numbers as their words, and at least two, so a lone
    "B" gets its share), and each break moves to the quietest moment near it, which is where one
    word gives way to the next."""
    words = text.split()
    sounds = [max(2, len(re.sub(r"[^a-z]", "", words_for(w).lower()))) for w in words]
    hop = rate // 100  # 10 ms
    frames = len(audio) // hop
    loud = np.sqrt(np.mean(np.asarray(audio[:frames * hop], dtype=float).reshape(frames, hop) ** 2, axis=1))
    loud = np.convolve(loud, np.ones(3) / 3, mode="same")
    starts, said = [0.0], 0
    for n in sounds[:-1]:
        said += n
        guess = round(frames * said / sum(sounds))
        lo = max(guess - 9, round(starts[-1] * 100) + 6)
        hi = min(guess + 9, frames - 1)
        at = lo + int(np.argmin(loud[lo:hi])) if hi > lo else guess
        starts.append(round(at / 100, 3))
    return starts


# The Reel's sounds that aren't the app's own, made here: air rushing past for the swipes, a glide
# under the needle, and a low hit when it lands.
RATE = 48000


def smooth_noise(n, cutoff, seed):
    """White noise through a low-pass whose cutoff (Hz, one per sample) can move."""
    noise = np.random.default_rng(seed).standard_normal(n)
    pull = 1 - np.exp(-2 * np.pi * np.asarray(cutoff, dtype=float) / RATE) * np.ones(n)
    out, y = np.empty(n), 0.0
    for i in range(n):
        y += pull[i] * (noise[i] - y)
        out[i] = y
    return out / (np.abs(out).max() + 1e-9)


def whoosh(dur=0.5):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    swell = np.sin(np.pi * t / dur) ** 2
    air = smooth_noise(n, 300 + 5200 * swell, 3) * swell
    side = t / dur * np.pi / 2  # it moves from left to right
    return np.stack([air * np.cos(side), air * np.sin(side)], 1)


def boom(dur=0.9):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    pitch = 38 + 70 * np.exp(-t * 14)
    body = np.sin(2 * np.pi * np.cumsum(pitch) / RATE) * np.exp(-t * 5.5)
    click = smooth_noise(n, 2500, 9) * np.exp(-t * 90) * 0.6
    out = np.tanh(1.6 * (body + click)) * 0.9
    return np.stack([out, out], 1)


def glide(curve, dur):
    """A tone that follows the needle, higher toward #1, louder the faster it moves."""
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    where = np.interp(t, np.arange(len(curve)) * 0.01, curve)
    pitch = 220 * 2 ** (2 * (1 - where))
    speed = np.convolve(np.abs(np.gradient(where)) * RATE, np.ones(960) / 960, mode="same")
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    tone = np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.15 * np.sin(3 * phase)
    out = (0.7 * tone / 1.5 + 0.3 * smooth_noise(n, pitch * 4, 11)) * (0.25 + 0.75 * np.clip(speed / 2.5, 0, 1))
    out *= np.clip(t / 0.04, 0, 1) * np.clip((dur - t) / 0.15, 0, 1)
    return np.stack([out, out], 1)


def cue_sound(cue, made={}):
    name = cue["sound"]
    if name == "glide":
        return glide(cue["curve"], cue["dur"])
    if name == "whoosh":
        return whoosh()
    if name == "boom":
        return boom()
    if name not in made:
        sound, rate = soundfile.read(SOUNDS / f"{name}.wav", dtype="float64", always_2d=True)
        if rate != RATE:
            fail(f"public/sounds/{name}.wav isn't 48 kHz")
        made[name] = sound if sound.shape[1] == 2 else np.repeat(sound, 2, 1)
    return made[name]


def write_audio(plan, spoken, scratch):
    """The voice on one track and the sounds on another, each put where the page said."""
    voice_rate = VOICE_RATE
    voice = np.zeros(int((plan["end"] + 1) * voice_rate), dtype=np.float32)
    for line in plan["voice"]:
        audio = spoken[line["key"]][0]
        at = int(line["at"] * voice_rate)
        voice[at:at + len(audio)] += audio[:len(voice) - at]
    sounds = np.zeros((int((plan["end"] + 1) * RATE), 2))
    for cue in plan["cues"]:
        sound = cue_sound(cue) * cue["gain"]
        at = int(cue["t"] * RATE)
        if at < len(sounds):
            sounds[at:at + len(sound)] += sound[:len(sounds) - at]
    soundfile.write(scratch / "voice.wav", voice, voice_rate, subtype="FLOAT")
    soundfile.write(scratch / "sounds.wav", sounds.astype(np.float32), RATE, subtype="FLOAT")
    return scratch / "voice.wav", scratch / "sounds.wav"


def make_reel(page, plan, audio, out):
    """Chrome lays out each frame and ffmpeg makes the video Instagram wants: H.264 at 30 frames a
    second, with AAC sound. The sounds step back while the voice talks, and the whole is brought to
    the loudness Instagram plays at."""
    ffmpeg = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
    if not Path(ffmpeg).exists():
        fail("The Reel needs ffmpeg. Install it with: brew install ffmpeg")
    graph = (
        # Chrome's JPEGs are full-range BT.601; video is limited-range BT.709.
        "[0:v]scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1[v];"
        # Instagram plays its song at one level the whole way (the API has no ducking), so the
        # voice is made to cut through it instead: low rumble off, less mud, more of the range
        # speech is understood by, and its quiet syllables brought up.
        "[1:a]aresample=48000,highpass=f=90,equalizer=f=300:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1:g=3,"
        "acompressor=threshold=0.1:ratio=3:attack=5:release=80:makeup=2,pan=stereo|c0=c0|c1=c0,asplit[voice][key];"
        "[2:a][key]sidechaincompress=threshold=0.05:ratio=3:attack=5:release=250[sounds];"
        "[voice][sounds]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]"
    )
    frames = round(plan["end"] * FPS)
    proc = subprocess.Popen([
        ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
        "-i", str(audio[0]), "-i", str(audio[1]), "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-tune", "animation", "-crf", "17",
        "-maxrate", "20M", "-bufsize", "40M", "-r", str(FPS), "-colorspace", "bt709", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{frames / FPS:.3f}",
        "-movflags", "+faststart", str(out),
    ], stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    cdp = page.context.new_cdp_session(page)
    try:
        for f in range(frames):
            page.evaluate(f"seek({f / FPS})")
            shot = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 95, "optimizeForSpeed": True})
            proc.stdin.write(base64.b64decode(shot["data"]))
        proc.stdin.close()
    except BrokenPipeError:
        pass
    if proc.wait() != 0:
        fail(f"ffmpeg couldn't make the Reel:\n{proc.stderr.read().decode(errors='ignore')[-2000:]}")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--index" in sys.argv:
        args.remove(sys.argv[sys.argv.index("--index") + 1])
    if len(args) != 1:
        fail("Usage: python3 render-chart-card.py posts/<date>   (the folder with post.json)")
    folder = Path(args[0]).expanduser().resolve()
    if folder.suffix == ".json":
        folder = folder.parent
    try:
        post = json.loads((folder / "post.json").read_text())
    except FileNotFoundError:
        fail(f"No post.json in {folder}")
    for key in ("date", "song", "artist"):
        if not str(post.get(key, "")).strip():
            fail(f"post.json needs \"{key}\".")

    index = find_index(sys.argv)
    if not index.exists():
        fail(f"Can't find the Hot 100 index at {index}.\n"
             "Run this from a copy of the Tempify repo, or pass --index <path to hot-100-songs.json>.")
    rows = json.loads(index.read_text())

    row = look_up(rows, post)
    peak = row[2] if row else None
    letter = answer_letter(peak)
    yesterday = date.fromisoformat(post["date"]) - timedelta(days=1)
    poll = post.get("poll", True)
    (folder / "art.jpg").unlink(missing_ok=True)
    art = find_art(post, folder)
    biggest = biggest_for(rows, row, post)
    data = {
        "song": post["song"],
        "artist": post["artist"],
        "puzzle": (yesterday - FIRST_DAY).days + 1,
        "peak": peak,
        "answer": letter,
        "facts": facts_for(row, post),
        "biggest": biggest,
        "missed": missed_for(rows, post, biggest) if row is None else None,
        "dare": "A" if letter in "CD" else "D",
        "poll": poll,
        "art": "file://" + pathname2url(str(folder / "art.jpg")) if art else None,
        "weeks": row[3] if row else None,
        "weeksAt1": row[4] if row else None,
        "firstYear": int(row[5][:4]) if row else None,
        "year": post.get("year"),
        # How the names are given to the voice: set once the ear has picked (pick_spellings).
        "saySong": None,
        "sayArtist": None,
        "sayBiggest": None,
        "sayMissed": None,
    }

    started = time.time()
    scratch = Path(tempfile.mkdtemp(prefix="tempify-chart-"))
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, args=[
                "--force-color-profile=srgb", "--allow-file-access-from-files", "--hide-scrollbars"])
            for n in (1, 2, 3):
                save_jpeg(picture(browser, data, f"?slide={n}", POST), folder / f"{n}.jpg")
            # The page says what the voice reads; the voice says how long it takes; the page
            # times the Reel around that.
            page = open_card(browser, data, "?format=reel", REEL)
            model, listener = voice_model(), ear()
            names = names_for(post, data)
            picks = pick_spellings(page, model, listener, names)
            lines, spoken, heard_lines = speak(page, model, listener, names, picks)
            page.context.close()
            for n in names:
                data[SAY_KEYS[n["key"]]] = None if picks[n["key"]] == plain_quotes(n["name"]) else picks[n["key"]]
            data["voice"] = {key: info for key, (_, info) in spoken.items()}
            page = open_card(browser, data, "?format=reel", REEL)
            if [line["text"] for line in page.evaluate("voiceLines()")] != [line["text"] for line in lines]:
                fail("The template's lines came out differently for the Reel than for the voice.")
            plan = page.evaluate("plan()")
            make_reel(page, plan, write_audio(plan, spoken, scratch), folder / "reel.mp4")
            page.context.close()
            save_jpeg(picture(browser, data, f"?format=reel&t={plan['cover']}", REEL), folder / "reel-cover.jpg")
            browser.close()
    finally:
        shutil.rmtree(scratch, ignore_errors=True)

    # What the ear heard, for the bot's look and for anyone checking a name Jett says is wrong:
    # each name's spelling for the voice, the sounds it was meant to have when they were given,
    # and how far off it was at worst (name_costs). "unsure" is a name the voice kept missing.
    said_names = []
    for n in names:
        off = max((h["names"].get(n["key"], 0) for h in heard_lines if "names" in h), default=0)
        given = (post.get("sounds") or {}).get(n["name"])
        said_names.append({"key": n["key"], "name": n["name"], "said_as": data[SAY_KEYS[n["key"]]],
                           "sounds": given, "off": off, "unsure": off > (OFF if given else GUESSED)})
    facts = {**data, "art": art, "said": [line["text"] for line in lines], "heard": heard_lines,
             "names": said_names}
    del facts["voice"]
    (folder / "facts.json").write_text(json.dumps(facts, indent=2, ensure_ascii=False) + "\n")
    choices = {f"option_{z.lower()}": f"{z}. {label}" for z, label in ZONES}
    (folder / "poll.json").write_text(json.dumps(choices, ensure_ascii=False) + "\n")
    tag = re.sub(r"[^a-z0-9]", "", norm(post["artist"]))
    (folder / "caption.txt").write_text(
        (CAPTION_POLL if poll else CAPTION).format(song=post["song"], artist=post["artist"], tag=tag) + "\n")

    said = f"#{peak}" if peak else "never charted"
    print(f"{post['song']} by {post['artist']}: {said}, answer {letter}"
          + (f" ({row[0]} by {row[1]} in the index)" if row else ""))
    if data["biggest"]:
        b = data["biggest"]
        print(f"Their biggest: {b['title']}, {b['detail']}")
    for n in said_names:
        print(f"Said {n['name']}" + (f" as {n['said_as']}" if n["said_as"] else "") + f": {n['off']} off"
              + (", so it may be said wrong: listen to it" if n["unsure"] else ""))
    print(f"Cover: Cover Art Archive release group {art}" if art else "Cover: none")
    print(f"The Reel is {plan['end']:.1f} seconds. Made in {time.time() - started:.0f} seconds.")
    print(f"Wrote reel.mp4, reel-cover.jpg, 1.jpg to 3.jpg, caption.txt, poll.json and facts.json in {folder}")


if __name__ == "__main__":
    main()
