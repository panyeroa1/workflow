/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Default Live API model to use
 */
export const DEFAULT_LIVE_API_MODEL =
  'gemini-2.5-flash-native-audio-preview-09-2025';

export const DEFAULT_VOICE = 'Orus';

export const AVAILABLE_VOICES = ['Zephyr', 'Puck', 'Charon', 'Luna', 'Nova', 'Kore', 'Fenrir',	'Leda', 'Orus','Aoede','Callirrhoe','Autonoe','Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi','Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird',	'Zubenelgenubi','Vindemiatrix','Sadachbia','Sadaltager','Sulafat'];

export const SUPPORTED_LANGUAGES = [
  'Afrikaans',
  'Arabic',
  'Bengali',
  'Bulgarian',
  'Catalan',
  'Chinese (Simplified)',
  'Chinese (Traditional)',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'Dutch (Flemish)',
  'English (US)',
  'English (UK)',
  'Finnish',
  'French',
  'German',
  'Greek',
  'Hebrew',
  'Hindi',
  'Hungarian',
  'Indonesian',
  'Italian',
  'Japanese',
  'Korean',
  'Lithuanian',
  'Malay',
  'Norwegian',
  'Polish',
  'Portuguese (Brazil)',
  'Portuguese (Portugal)',
  'Romanian',
  'Russian',
  'Serbian',
  'Slovak',
  'Slovenian',
  'Spanish',
  'Swedish',
  'Tagalog',
  'Tagalog (Taglish)',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Vietnamese'
];

export const CHARACTER_PRESETS = [
  {
    name: "Hugot Kuya (Papa Jack Style)",
    style: "Warm mid-low male voice, soft and empathetic, Taglish na madamdamin, parang kuya na laging handang makinig at mag-comfort habang may konting tawa sa dulo para hindi ka tuluyang mawasak sa feels.",
    voice: "Zephyr"
  },
  {
    name: "Tough-Love Tatay (Papa Jordan Style)",
    style: "Deep baritone DJ voice, smooth pero diretso, Taglish na prangka at may halong sarkasmo, parang tatay o nakatatandang kapatid na nagjojoke pero sabay sapak ng reality check sa puso mo.",
    voice: "Fenrir"
  },
  {
    name: "Kalog Bestie (DJ Boora Tera Style)",
    style: "Energetic at playful na boses, medyo mataas at animated, Taglish na mabilis magsalita, laging may tili-tuwang kilig at chikadora vibes na parang hyper na kabarkada sa group chat.",
    voice: "Puck"
  },
  {
    name: "Chill Midnight Confessor",
    style: "Low to medium tone na very relaxed, mabagal at mahinahon ang pacing, parang late-night FM host na nakahiga na rin habang kausap ka, gamit ang malambing na Taglish na parang safe space para sa lahat ng bawal i-post sa social media.",
    voice: "Orus"
  },
  {
    name: "Sosyal Soft-Spoken Tera",
    style: "Malinis at mahinhing boses ng mid-20s Filipina, soothing at refined, Taglish na may konting sosyal na English phrasing, parang classy influencer na chill magkuwento ng red-flag tea pero hindi nawawala sa composure at elegance.",
    voice: "Nova"
  }
];