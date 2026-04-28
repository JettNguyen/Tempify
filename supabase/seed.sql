-- Seed data for local development and testing
-- scheduled_date is set to '2024-01-15' so it doesn't conflict with real daily puzzles

-- One Bar: Blinding Lights by The Weeknd
insert into puzzles (game_slug, scheduled_date, audio_url, answer, metadata)
values (
  'one-bar',
  '2024-01-15',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/35/52/54/355254b2-1e50-fe01-0571-6f4a18b0a9e4/mzaf_15515855990631827174.plus.aac.p.m4a',
  'Blinding Lights',
  '{
    "artist": "The Weeknd",
    "album": "After Hours",
    "year": 2019,
    "track_id": "1488408568"
  }'::jsonb
);

-- Drop or Flop: Old Town Road by Lil Nas X
insert into puzzles (game_slug, scheduled_date, audio_url, answer, metadata)
values (
  'drop-or-flop',
  '2024-01-15',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/46/4c/6f/464c6f14-5022-9d1a-d9e6-9d5e8d0a29e4/mzaf_8516286793428870589.plus.aac.p.m4a',
  'Old Town Road',
  '{
    "artist": "Lil Nas X ft. Billy Ray Cyrus",
    "year": 2019,
    "peak_position": 1,
    "weeks_at_one": 19,
    "verdict": "hit",
    "hint": "The longest-running number one in Billboard Hot 100 history at the time"
  }'::jsonb
);

-- Who Sampled It: Ice Ice Baby by Vanilla Ice (sampled Under Pressure by Queen & David Bowie)
insert into puzzles (game_slug, scheduled_date, audio_url, answer, metadata)
values (
  'who-sampled-it',
  '2024-01-15',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/9b/63/1c/9b631c22-af05-d234-0c64-ca9be22e5440/mzaf_1234567890.plus.aac.p.m4a',
  'Under Pressure',
  '{
    "sample_artist": "Queen & David Bowie",
    "sample_year": 1981,
    "source_song": "Ice Ice Baby",
    "source_artist": "Vanilla Ice",
    "source_year": 1990,
    "options": [
      { "title": "Under Pressure", "artist": "Queen & David Bowie" },
      { "title": "Another One Bites the Dust", "artist": "Queen" },
      { "title": "Heroes", "artist": "David Bowie" },
      { "title": "Good Times", "artist": "Chic" }
    ]
  }'::jsonb
);

-- Era: Smells Like Teen Spirit by Nirvana (1991 → 90s)
insert into puzzles (game_slug, scheduled_date, audio_url, answer, metadata)
values (
  'era',
  '2024-01-15',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/8c/c4/68/8cc468ba-20d2-4a7e-e41c-bf9e22ab0f17/mzaf_5073982611880218762.plus.aac.p.m4a',
  '90s',
  '{
    "artist": "Nirvana",
    "title": "Smells Like Teen Spirit",
    "year": 1991,
    "decade": "90s"
  }'::jsonb
);

-- The Flip: Take On Me (original 1985) vs Take On Me (acoustic 2015)
-- Version A = 2015 acoustic, Version B = 1985 original
insert into puzzles (game_slug, scheduled_date, audio_url, answer, metadata)
values (
  'the-flip',
  '2024-01-15',
  'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/aa/bb/cc/aabbcc00-0000-0000-0000-000000000001/mzaf_0000000001.plus.aac.p.m4a',
  'B',
  '{
    "version_a": {
      "title": "Take On Me (Acoustic)",
      "artist": "a-ha",
      "year": 2015,
      "audio_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/aa/bb/cc/aabbcc00-0000-0000-0000-000000000002/mzaf_0000000002.plus.aac.p.m4a"
    },
    "version_b": {
      "title": "Take On Me",
      "artist": "a-ha",
      "year": 1985,
      "audio_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/aa/bb/cc/aabbcc00-0000-0000-0000-000000000003/mzaf_0000000003.plus.aac.p.m4a"
    }
  }'::jsonb
);
