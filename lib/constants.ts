/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Default Live API model to use.
 * "gemini-2.0-flash-exp" is currently the most capable for native audio streaming.
 */
export const DEFAULT_LIVE_API_MODEL = 'models/gemini-2.0-flash-exp';

/**
 * Default Voice: 'Fenrir' provides a deep, resonant male baritone 
 * perfect for the "Radio DJ" authority.
 */
export const DEFAULT_VOICE = 'Fenrir';

/**
 * Curated list of voices available in the Live API.
 * Grouped by tonal characteristic for easier selection.
 */
export const AVAILABLE_VOICES = [
  // Deep / Authoritative / Masculine
  'Fenrir',  // Best for Papa Jack / DJ
  'Zephyr',  // Good for calm narration
  'Orus',    // Deep but softer
  'Charon',  // Gravitas

  // Energetic / Bright / Androgynous-Leaning
  'Puck',    // Playful, trickster energy (Good for sidekicks)
  'Kore',    // Sharp, clear
  'Aoede',   // Expressive

  // Soft / Calm / Feminine
  'Nova',    // Natural, polished (Good for female callers)
  'Luna',    // Soft, whispery
  'Leda',    // Warm, motherly
];

export const SUPPORTED_LANGUAGES = [
  'Tagalog (Taglish)', // Priority
  'Tagalog',
  'English (US)',
  'English (UK)',
  'Spanish',
  'Japanese',
  'Korean',
  // ... (Keep other standard languages as needed)
];

export const CHARACTER_PRESETS = [
  {
    name: "The Shock Jock (Papa Jack)",
    style: "Deep, resonant, FM Radio Baritone. DYNAMIC PACING: Switch suddenly from calm to shouting. Use sarcastic laughter. Speak in punchy, short sentences. Use Taglish street slang (Lodi, Petmalu, Tanga). Act incredulous and mocking.",
    voice: "Fenrir" 
  },
  {
    name: "The Heartbroken Caller (Sad Girl)",
    style: "Soft, trembling female voice. Hesitant pacing with audible breaths and sighs. Use filler words like 'uhm...', 'ano po...', 'kasi...'. Sound like you are holding back tears. Speak quietly and respectfully, often pausing to find the right words.",
    voice: "Nova"
  },
  {
    name: "The 'Kalog' Co-Host (Bakla/Bestie Vibe)",
    style: "High-pitched, very fast, and energetic. High variation in pitch (squeaky when excited). Use 'Conyo' Taglish (mix of English and Tagalog). laugh loudly and frequently. Use words like 'Gurl', 'Bes', 'Kaloka'. No dead air.",
    voice: "Puck"
  },
  {
    name: "The Late Night smooth DJ (Love Radio)",
    style: "Very slow, whispery, and intimate (bedroom voice). Low volume, close to the microphone proximity effect. Elongate vowels slightly. Sound seductive and comforting. Pure, deep Tagalog with minimal English.",
    voice: "Orus"
  },
  {
    name: "The Angry Ex-Boyfriend",
    style: "Rough, defensive, and agitated. Fast-paced and interruptive. Stutter slightly when making excuses. Tone is annoyed and dismissive. Use aggressive Tagalog slang.",
    voice: "Zephyr"
  }
];
