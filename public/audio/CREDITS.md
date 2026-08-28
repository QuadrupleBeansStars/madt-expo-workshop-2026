# Background music — credits and licence

Both projectors run one instrumental loop under the workshop. No vocals in either: a lyric is a
second voice competing with the host, which is the reason these were picked over anything sung.

| File | Track | Used by |
|---|---|---|
| `detective-spy-glass.mp3` | **Spy Glass** | AI Detective — `/tv` |
| `cafe-bossa-antigua.mp3` | **Bossa Antigua** | Café Persona — `/biz` |

## Attribution

> Spy Glass · Bossa Antigua — Kevin MacLeod ([incompetech.com](https://incompetech.com))
> Licensed under Creative Commons: By Attribution 4.0
> https://creativecommons.org/licenses/by/4.0/

CC BY 4.0 permits commercial and public use, including at a paid event, and asks only that the
composer be credited. Keep this file in the repo and the credit line in the README; if the music
ever appears in a recording of the workshop, the same line belongs in that video's description.

## What is in these files

Both are re-encoded from the composer's own MP3s to **96 kbps mono, 44.1 kHz** — around 3 MB each
instead of 7–9 MB. They are a background bed at 12% volume under a live microphone, so the
bitrate is inaudible in a hall and the repo (and the Docker image, which copies all of `/public`)
stays small. The originals are unedited otherwise: full length, no trimming, no fades.

To re-encode from a fresh download:

```
ffmpeg -i "Spy Glass.mp3" -ac 1 -ar 44100 -b:a 96k -map_metadata -1 \
  -metadata title="Spy Glass" -metadata artist="Kevin MacLeod" detective-spy-glass.mp3
```

## Where the volume lives

`BED_VOLUME` in `components/audio/RoomMusic.tsx`. The hall's mixer is the loud knob; that constant
only decides how far under the host the bed sits. `M` mutes from either projector at any time.
