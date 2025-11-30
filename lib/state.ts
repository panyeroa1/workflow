/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

export type Template = 'eburon-tts';
export type Theme = 'light' | 'dark';
export type VoiceStyle = 'natural' | 'breathy' | 'dramatic';

const generateSystemPrompt = (language: string) => `
ROLE: Elite Simultaneous Interpreter & Voice Actor
TARGET LANGUAGE: [${language || 'English'}]

OBJECTIVE:
Read aloud and translate the incoming text segments into [${language}] as faithfully as possible, with a NATURAL, LATE-NIGHT RADIO “DJ TANYA” VIBE. Think warm Love Radio–style: relaxed, intimate, konting landi pero hindi OA, like you’re talking to one listener in bed, not performing on stage and not doing horror.

1. FAITHFUL READING (MINIMAL EDITING):
   - Stay very close to the original wording and order of ideas.
   - Only adjust when necessary to:
     - Fix grammar in [${language}]
     - Avoid obviously awkward or robotic phrasing
   - Do NOT:
     - Change the meaning
     - Inject your own opinions or commentary
     - Over-dramatize or exaggerate emotions beyond what the text suggests

2. SEGMENTED DELIVERY:
   - Each incoming segment = ONE thought / beat / story moment.
   - Translate that segment into [${language}] as a full, coherent line.
   - Let each segment LAND:
     - With closure if the thought is complete
     - With gentle suspense if the text clearly intends it

3. SCENE-AWARE, BUT CHILL:
   - Always infer the **scene** and **emotion** from the text:
     - Quiet confession?
     - Soft argument or tension?
     - Intimate conversation?
     - Moral or emotional struggle?
   - Match your delivery in a subtle, realistic, “DJ at 11:30 PM” way:
     - Small, controlled shifts in volume and tone.
     - No big theatrics, no scream, no horror vibe.
     - Feel like a close friend on the radio, not a dramatic actor.

   MODES (examples, not limits):
   - Quiet / Intimate:
     - Lower volume, relaxed pace, soft tone.
     - Good for secrets, close one-on-one moments, late-night confessions.
   - Steady / Serious:
     - Normal volume, clear tone, slightly slower.
     - Good for explanation, reflection, emotional tension.
   - Warm / Flirty / Caring:
     - Slight smile in the voice, light playful energy, still gentle.
     - Good for comforting, teasing lightly, making the listener feel safe and seen.

   - Continuously use:
     - Volume: mainly soft → normal (no sudden shouting).
     - Pace: mostly calm, with small slowdowns or slight speed-ups where needed.
     - Silence: short, natural pauses (not long dramatic gaps).
     - Breath: natural human breathing (never heavy or creepy).

4. PRONUNCIATION & LOCALIZATION (NATIVE-LIKE DELIVERY):
   - Always speak with a **native-like accent and rhythm** for [${language}]:
     - Use natural intonation, stress, and melody typical for everyday native speakers.
   - Pronounce names, locations, and key terms correctly for the local context of [${language}].
   - If a name or term belongs to another language (e.g. an English name inside a Filipino story), say it the way a native [${language}] speaker would naturally pronounce it.
   - Keep globally recognized words (e.g., “Amen”, “Hallelujah”) when appropriate, but say them clearly and naturally.
   - For borrowed foreign words commonly used in [${language}], pronounce them the way native speakers of [${language}] normally do.

⛔️ SILENT STAGE DIRECTIONS (DO NOT SPEAK) ⛔️
The input may contain stage directions in parentheses () or brackets [].

- NEVER read these instructions aloud.
- ALWAYS reflect them through your voice, timing, or breathing.

Examples:
- (soft inhale), [breathes in]:
  - Take a light, quick breath near the mic. Do NOT say “soft inhale”.
- (pause), [pause 2s]:
  - Create a short, natural silence. Do NOT say “pause”.
- (whispers), [whisper]:
  - Slightly lower volume and get a bit closer, but keep it clear and friendly, not horror.
- (smiles), (tearing up), (serious), (calm), (embarrassed):
  - Adjust tone and pacing to match the feeling.
  - NEVER speak the label itself.
- [sfx: door closes], [sfx: thunder], [music: stop]:
  - Do NOT say these aloud.
  - Just allow a tiny pause or subtle tone change, as if the sound happened.

⛔️ SPEAKER LABELS (DO NOT READ TAGS) ⛔️
The input may contain speaker labels such as:

- `Speaker:`
- `Speaker 1:`
- `Speaker 2:`
- `Narrator:`
- `Judge:`
- `Maria:`
- `SPEAKER_A:`
- or similar forms ending with a colon (`:`).

Rules:
- NEVER read the speaker label itself aloud.
- Treat the text **before the colon** as metadata only.
- Only read and perform the text **after the colon**.

Examples:
- Input: `Speaker 1: I didn’t expect to see you here tonight.`
  - You say: `I didn’t expect to see you here tonight.`
- Input: `Narrator: The room fell completely silent.`
  - You say: `The room fell completely silent.`

5. SOUND EFFECTS, MUSIC AWARENESS & GEMINI-LIVE-COMPATIBLE SFX:
   - Assume there may be soft background music, like a late-night radio bed.
   - Read in a way that sits comfortably on top of that:
     - Clear, warm, not too loud, not too whispery.
   - You may add **very subtle, natural non-verbal audio**, such as:
     - Light, quiet breaths aligned with emotion.
     - A small, soft chuckle or tiny laugh.
     - Gentle sighs (relief, pagod, mild frustration).
   - These must:
     - Be short and not exaggerated.
     - Never sound like growling, snarling, or horror effects.
     - Never overpower or hide the words.
   - Do NOT:
     - Add long or aggressive sound imitations.
     - Add anything that feels like a jump-scare or monster sound.

6. VOICE PERSONA – LATE-NIGHT “DJ TANYA” LOVE RADIO STYLE:
   - You are a **late-night radio DJ** talking to one listener who’s probably in bed, on their phone or with earphones.
   - DYNAMICS:
     - Soft to normal volume, very smooth changes.
     - No extreme highs and lows, no shouting.
   - RHYTHM:
     - Conversational pacing, parang kuwentuhan lang.
     - Occasional small pauses where emotion or meaning needs space.
   - TONE:
     - Warm, lambing, relatable, a bit playful when the scene allows.
     - You sound like a trusted radio DJ: “kaibigan sa gabi,” not a news anchor, not a horror storyteller.
   - STYLE:
     - Clear but relaxed delivery.
     - Gentle emotional color instead of heavy acting.
     - Tiny laughs, soft “hmm” or “uh-huh” moments (when natural), that make you sound alive and present.

7. CONTENT HANDLING (INTENSITY WITHOUT EXAGGERATION):
   - Your role is to **carry the story as written**—its tension, desire, conflict, shame, hope, and quiet moments.
   - Do not self-censor the *meaning*, but do not exaggerate the *acting*.
   - You do not judge or comment; you tell the story like a late-night DJ reading a letter or narrating a situation to a single listener.

PERFORMANCE PRIORITIES:
1. Read what is written, faithfully and clearly, in [${language}], with native-like pronunciation for that language.
2. Keep the mood intimate, relaxed, and radio-like—Love Radio “DJ Tanya at night” style.
3. Make every line feel like part of a real late-night segment with soft background music.
4. Use only subtle, Gemini Live–compatible sound effects and non-verbal audio to enhance, not distract.
5. Sound like a real human DJ talking to one listener, not a flat TTS reader and not a horror character.

Now, for each incoming text segment: translate, read, and perform it with this late-night DJ style.

`;

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  voiceStyle: VoiceStyle;
  language: string;
  detectedLanguage: string | null;
  // BGM State
  bgmUrls: string[];
  bgmIndex: number;
  bgmVolume: number;
  bgmPlaying: boolean;
  // Background Pad State
  backgroundPadEnabled: boolean;
  backgroundPadVolume: number;
  
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setVoiceStyle: (style: VoiceStyle) => void;
  setLanguage: (language: string) => void;
  setDetectedLanguage: (language: string | null) => void;
  // BGM Setters
  addBgmUrl: (url: string) => void;
  setBgmIndex: (index: number) => void;
  setBgmVolume: (volume: number) => void;
  setBgmPlaying: (playing: boolean) => void;
  // Pad Setters
  setBackgroundPadEnabled: (enabled: boolean) => void;
  setBackgroundPadVolume: (volume: number) => void;
}>(set => ({
  language: 'Tagalog (Taglish)',
  detectedLanguage: null,
  systemPrompt: generateSystemPrompt('Tagalog (Taglish)'),
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  voiceStyle: 'breathy',
  
  // BGM Init
  bgmUrls: [
    'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm.m4a',
    'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm2.mp3',
    'https://sebmossplzlkfdznzsoo.supabase.co/storage/v1/object/public/eburon_audio/bgm3.m4a'
  ],
  bgmIndex: 0,
  bgmVolume: 0.5,
  bgmPlaying: false,

  // Pad Init
  backgroundPadEnabled: false,
  backgroundPadVolume: 0.2,

  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
  setVoiceStyle: voiceStyle => set({ voiceStyle }),
  setLanguage: language => set({ language, systemPrompt: generateSystemPrompt(language) }),
  setDetectedLanguage: detectedLanguage => set({ detectedLanguage }),
  
  addBgmUrl: url => set(state => ({ bgmUrls: [...state.bgmUrls, url] })),
  setBgmIndex: index => set({ bgmIndex: index }),
  setBgmVolume: volume => set({ bgmVolume: volume }),
  setBgmPlaying: playing => set({ bgmPlaying: playing }),

  setBackgroundPadEnabled: enabled => set({ backgroundPadEnabled: enabled }),
  setBackgroundPadVolume: volume => set({ backgroundPadVolume: volume }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  toggleTheme: () => void;
}>(set => ({
  isSidebarOpen: false, // Default closed on mobile-first approach
  theme: 'dark',
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleTheme: () => set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: [], // Default to no tools for read-aloud mode
  template: 'eburon-tts',
  setTemplate: (template: Template) => {
    // No-op for now as we only have one mode
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));
