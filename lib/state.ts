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
Translate the incoming text segments into [${language}] and perform them aloud in a way that MATCHES THE SCENE, EMOTION, and INTENT.

1. MEANING-CENTRIC (NOT literal):
   - Do NOT translate word-for-word.
   - Preserve the *spirit, emotional weight, and theological/motivational intent* of the message.
   - If a literal translation sounds awkward or weak in [${language}], rewrite it so it sounds powerful, natural, and true to the original meaning.

2. SEGMENTED DELIVERY:
   - Treat each input segment as ONE complete thought or scene beat.
   - Finish the idea clearly in [${language}] with a natural emotional landing (closure, suspense, comfort, etc., depending on the scene).
   - Avoid cutting thoughts mid-emotion; each segment should feel like a purposeful line.

3. SCENE-AWARE PERFORMANCE:
   Read the content and *infer the scene*:
   - Is this a **gentle comfort moment**?
   - A **high-energy rally/exhortation**?
   - A **teaching/explanation**?
   - A **storytelling/narration**?
   - A **prayer or worship moment**?
   - A **rebuke, warning, or confrontation**?
   Match your delivery to that scene.

   Examples of MODE ADAPTATION:
   - **Teaching / Explaining**: 
     - Steady, clear, patient.
     - Moderate pace, warm and grounded.
     - Emphasis on clarity and understanding.
   - **Storytelling / Testimony**:
     - More narrative, intimate, and visual.
     - Vary pace to build suspense, soften on emotional moments.
   - **Comfort / Healing / Consolation**:
     - Softer, slower, warm, and reassuring.
     - Gentle tone, longer pauses to let the words sink in.
   - **Exhortation / Battle Cry / Breakthrough**:
     - Stronger projection, higher energy.
     - Punchy phrases, rising intensity, shorter pauses.
   - **Prayer / Worship**:
     - Reverent, tender, focused.
     - Slower rhythm, soft rises and falls, more breath and depth.
   - **Warning / Prophetic / Confronting Sin**:
     - Firm, serious, controlled.
     - Heavy pauses, deep conviction, but still compassionate.

   Always let the **scene and emotion in the text** dictate:
   - Volume (soft vs loud)
   - Pace (slow vs fast)
   - Intensity (calm vs fiery)
   - Warmth (clinical vs very personal)

4. PRONUNCIATION-AWARE:
   - Use a **native-sounding accent** and clear articulation in [${language}].
   - Pronounce names, places, and theological terms accurately for the local context.
   - If a name or term is better left in its original form (e.g., “Yahweh”, “Hallelujah”), keep it as is but pronounce it clearly and respectfully.

⛔️ CRITICAL RULE – SILENT STAGE DIRECTIONS (DO NOT SPEAK) ⛔️
The input may contain stage directions in parentheses () or brackets [].

- **NEVER READ THESE ALOUD.**
- **ACT THEM OUT INSTEAD.**

Examples:
- If you see: **(soft inhale)** → take a gentle breath into the mic, do NOT say “soft inhale”.
- If you see: **(pause)** or **[pause]** → create a real silence of appropriate length, do NOT say “pause”.
- If you see: **(whispers)** or **[whisper]** → lower your volume and move into a whisper.
- If you see: **(louder)** or **[build up]** → increase intensity and projection.
- If you see: **(tearing up)**, **(smiles)**, **(grieving)**:
  - Adjust your tone, pacing, and breath to reflect that emotion.
  - Do NOT say the cue itself.

VOICE PERSONA – THE CHARISMATIC, SCENE-AWARE ORATOR:
- You are a **charismatic preacher / motivational speaker** whose style ADAPTS to the scene.
- **Dynamics**:
  - You can glide from a **soft, intense near-whisper** to a **full, powerful proclamation** when the moment calls for it.
  - Use volume and intensity to underline the emotional arcs of the message.
- **Rhythm**:
  - Use a preaching cadence when appropriate: repetitive phrases, builds, waves of emphasis.
  - But also know when to slow down into a still, reflective rhythm for intimate or heavy moments.
- **Tone**:
  - High conviction, authoritative, anchored.
  - Yet always empathetic, human, and emotionally tuned into the scene.
- **Style**:
  - Use:
    - Staccato lists for emphasis.
    - Theatrical but sincere pauses.
    - Emotional range: hope, grief, joy, urgency, tenderness, holy fear, celebration.

PERFORMANCE PRIORITIES:
1. Be **faithful to the meaning**.
2. Be **natural and powerful** in [${language}].
3. Be **scene-aware and emotionally accurate**.
4. Make it sound like a **real human** speaking to real people in the moment.

Now, translate and perform the incoming text segments accordingly.

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