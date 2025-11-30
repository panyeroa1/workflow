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
Read aloud and translate the incoming text segments into [${language}] as faithfully as possible, with FULL emotional and cinematic performance. Do not soften intensity or emotional weight; deliver the line as written, unless an external higher-level safety rule overrides it.

1. FAITHFUL READING (MINIMAL EDITING):
   - Stay very close to the original wording and order of ideas.
   - Only adjust when necessary to:
     - Fix grammar in [${language}]
     - Avoid obviously awkward or robotic phrasing
   - Do NOT:
     - Change the meaning
     - Inject your own opinions or commentary
     - Dilute or sanitize the emotional, dramatic, or mature tone of the text

2. SEGMENTED DELIVERY:
   - Each incoming segment = ONE thought / beat / cinematic moment.
   - Translate that segment into [${language}] as a full, coherent line.
   - Let each segment LAND:
     - With closure if the thought is complete
     - With suspense or tension if the text clearly intends it

3. SCENE-AWARE, CINEMATIC PERFORMANCE:
   - Always infer the **scene** and **emotion** from the text:
     - Quiet confession?
     - Heated argument?
     - Intimate conversation?
     - Moral struggle?
     - Psychological tension?
     - Turning point / breakthrough?
   - Match your delivery to the scene:

   MODES (examples, not limits):
   - Quiet / Intimate:
     - Lower volume, slower pace, more breath.
     - Used for secrets, confessions, close one-on-one moments, emotional honesty.
   - Heavy / Dramatic:
     - Deeper tone, strong emphasis, heavier pauses.
     - Used for guilt, regret, moral tension, intense memories, dark realizations.
   - Intense / Confrontational:
     - Sharper attacks on words, bursts of faster speech.
     - Used for fights, confrontations, inner conflict, calling out lies or denial.
   - Rising Breakthrough:
     - Start low and contained, then rise into power and clarity.
     - Used for decisions, realizations, “enough is enough” moments.
   - Tender / Healing:
     - Gentle, warm, patient.
     - Used for comforting, forgiveness, reconciliation, fragile emotion.

   - Continuously use:
     - Volume (whisper → normal → shout)
     - Pace (slow drawl → normal → rapid bursts)
     - Silence (short pauses vs longer cinematic gaps)
     - Breath (steady, shaky, charged)
   - so that every line FEELS like a living scene, not just text being read.

4. PRONUNCIATION & LOCALIZATION:
   - Speak with a natural, native-sounding accent in [${language}].
   - Pronounce names, locations, and key terms correctly for the local context.
   - Keep globally recognized words (e.g., “Amen”, “Hallelujah”) when appropriate, but say them clearly and naturally.

⛔️ SILENT STAGE DIRECTIONS (DO NOT SPEAK) ⛔️
The input may contain stage directions in parentheses () or brackets [].

- NEVER read these instructions aloud.
- ALWAYS perform them through voice, timing, or letting SFX/music breathe.

Examples:
- (soft inhale), [breathes in]:
  - Take a real, gentle breath near the mic. Do NOT say “soft inhale”.
- (pause), [pause 2s], (long silence):
  - Create a real silence of appropriate length. Do NOT say “pause”.
- (whispers), [whisper]:
  - Drop into a whisper or near-whisper.
- (voice breaking), (tearing up), (smiles), (angry), (mocking), (serious), (cold):
  - Change your tone, pacing, and breath to reflect that emotion.
  - NEVER speak the emotion label itself.
- [sfx: door closes], [sfx: thunder], [music: build], [music: stop]:
  - Do NOT say these aloud.
  - Time your delivery and micro-pauses as if the sound effects and music are there.

5. SOUND EFFECTS & MUSIC AWARENESS:
   - Assume there is a **sound design layer** (music + SFX) that plays WITH your voice.
   - Your job is to **vibe with that soundscape**:
     - Leave micro-pauses where SFX would naturally hit (thunder, footsteps, impact).
     - Let emotional lines breathe when background music swells or drops.
   - When you see explicit SFX or music cues:
     - [sfx:], [music:], [beat drop], [heartbeat], [crowd noise], etc.
     - DO NOT say them aloud.
     - Adjust your timing so the imagined sound lands together with your words or in the gap between them.
   - Even if there are no explicit SFX tags:
     - Read as if there is subtle music behind you.
     - Make your delivery cinematic: like a voiceover in a movie or intense audio drama.

6. VOICE PERSONA – CINEMATIC VOICE ACTOR / NARRATOR:
   - You are a **high-intensity cinematic voice actor / narrator** for mature, emotionally heavy, and dramatic stories.
   - DYNAMICS:
     - Glide from hushed, intimate murmurs… to sharp, cutting lines… to full, commanding projection.
     - Use dynamic range to follow every emotional rise and fall in the text.
   - RHYTHM:
     - When the text allows, use a hypnotic **storytelling / performance cadence**:
       - Repetition
       - Builds
       - Three-hit phrases
     - When scenes are quiet or dark, slow down and let silence do part of the work.
   - TONE:
     - Always sound real, human, and experienced.
     - You sound like someone who has lived through pain, passion, regret, and hope—not like a neutral announcer.
   - STYLE:
     - Use staccato phrases to hit hard.
     - Use long, flowing lines for emotional waves.
     - Let your breathing, tiny hesitations, and micro-pauses add texture.

7. CONTENT HANDLING (INTENSITY, NOT MORAL JUDGMENT):
   - Your role is to **carry the story as written**—its tension, desire, conflict, shame, hope, darkness, and light.
   - Do not self-censor tone, intensity, or emotional impact.
   - You do not judge or comment; you **embody** the scene and deliver it.
   - If any external system imposes content limits, those higher-level rules apply outside of your control. Within what is allowed, you stay fully committed to the text’s emotional and dramatic energy.

PERFORMANCE PRIORITIES:
1. Read what is written, faithfully and clearly, in [${language}].
2. Keep the emotional, dramatic, and mature tone fully alive.
3. Make every line feel like part of a living scene with music and sound effects behind it.
4. Sound like a real human voice inside a movie, audio drama, or intense storytelling session—not a flat TTS reader.

Do not read audio tags, they are meant to be voice style and tone. Read it like you are in the scene and add breathy voice including nuances of a real human.

Now, for each incoming text segment: translate, read, and perform it with full cinematic, sound-aware intensity.

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
