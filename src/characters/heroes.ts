// Compass Alliance — the 20 heroes, as data.
//
// Every visual decision here comes from the official character sheets and the
// "Character Visual Reference Guide" (colours, silhouettes, hair, accessories,
// anatomy). The procedural builder (buildHero.ts) turns a spec into a stylized
// 3D placeholder; a real GLB can replace any of them later (see docs/ASSETS.md).

export type Anatomy = 'humanoid' | 'centaur' | 'mecha' | 'dragon';
export type Role = 'leader' | 'melee' | 'ranged' | 'tank' | 'support' | 'flyer';
export type PowerKind = 'sword' | 'bolt' | 'fire' | 'water' | 'cosmic' | 'sonic' | 'missile' | 'plasma' | 'nature' | 'fists' | 'shield' | 'blade' | 'heal';
export type HairStyle =
  | 'none' | 'short' | 'swept' | 'slick' | 'spiky' | 'flame' | 'messy' | 'curly'
  | 'long' | 'wavy' | 'bun' | 'ponytail' | 'afro';

export interface HeroColors {
  skin: string;
  /** torso */
  suit: string;
  /** arms (defaults to suit) */
  sleeves?: string;
  /** legs (defaults to suit) */
  legs?: string;
  accent: string;
  accent2?: string;
  gloves?: string;
  boots?: string;
  belt?: string;
  hair: string;
  hair2?: string;
  eyes: string;
  /** energy / glow colour of the hero's power */
  glow: string;
}

export type Part =
  | { k: 'sword' }
  | { k: 'katana' }
  | { k: 'maltese-shield' }
  | { k: 'goggles' }
  | { k: 'hud-glasses' }
  | { k: 'eye-mask'; color: string }
  | { k: 'ninja-mask' }
  | { k: 'hood' }
  | { k: 'astronaut-helmet' }
  | { k: 'antenna-helmet' }
  | { k: 'phoenix-helmet' }
  | { k: 'mecha-helmet' }
  | { k: 'galaxy-cape' }
  | { k: 'wings'; style: 'flame' | 'mech' | 'butterfly' }
  | { k: 'horn' }
  | { k: 'dragon-head' }
  | { k: 'dragon-tail' }
  | { k: 'emblem'; shape: 'bolt2' | 'star' | 'cross' | 'triangle' | 'phoenix' | 'sigil' | 'gem' | 'notes' }
  | { k: 'stripes'; color: string }
  | { k: 'straps' }
  | { k: 'bracers'; color: string }
  | { k: 'shoulder-pads'; color: string; trim?: string }
  | { k: 'knee-pads'; color: string }
  | { k: 'gauntlets'; color: string }
  | { k: 'mech-arm' }
  | { k: 'missile-pods' }
  | { k: 'skirt'; style: 'tutu' | 'leaf' | 'tabard' }
  | { k: 'shells' }
  | { k: 'fin-ears' }
  | { k: 'birthmark' }
  | { k: 'mic' }
  | { k: 'drones' }
  | { k: 'collar'; color: string }
  | { k: 'wrist-device' }
  | { k: 'planet-belt' }
  | { k: 'chainmail' }
  | { k: 'earrings' }
  | { k: 'vest' }
  | { k: 'cargo-pockets' };

export interface HeroSpec {
  id: string;
  name: string;
  epithet: string;
  gender: 'male' | 'female' | 'male-presenting synthetic';
  age?: number;
  anatomy: Anatomy;
  role: Role;
  power: PowerKind;
  flies: boolean;
  body: {
    /** overall scale; 1 ≈ 1.85 m adult */
    height: number;
    /** shoulder width multiplier */
    bulk: number;
    /** limb thickness multiplier */
    muscle: number;
    feminine: boolean;
    /** sleeveless / short sleeves show skin on the arms */
    sleeves: 'full' | 'short' | 'none';
    /** bare legs (swimsuit, dress) */
    bareLegs?: boolean;
    bareChest?: boolean;
    bareFeet?: boolean;
  };
  colors: HeroColors;
  hair: HairStyle;
  parts: Part[];
  // descriptive reference (from the visual guide)
  appearance: string;
  costume: string;
  bodyLanguage: string;
  animationNotes: string;
  palette: string[];
}

export const HEROES: HeroSpec[] = [
  {
    id: 'paladin', name: 'Paladin', epithet: 'The Armored Leader', gender: 'male', anatomy: 'humanoid', role: 'leader', power: 'sword', flies: false,
    body: { height: 1.0, bulk: 1.18, muscle: 1.08, feminine: false, sleeves: 'full' },
    colors: { skin: '#e2b593', suit: '#2452b5', sleeves: '#16224d', legs: '#16224d', accent: '#2452b5', accent2: '#d6a93c', gloves: '#16224d', boots: '#2452b5', belt: '#1c1c22', hair: '#5b4128', eyes: '#3d7fe0', glow: '#6fb6ff' },
    hair: 'swept',
    parts: [{ k: 'sword' }, { k: 'wrist-device' }, { k: 'shoulder-pads', color: '#2452b5', trim: '#d6a93c' }, { k: 'knee-pads', color: '#d6a93c' }, { k: 'gauntlets', color: '#2452b5' }, { k: 'collar', color: '#16224d' }, { k: 'cargo-pockets' }],
    appearance: 'Young adult man, short swept-up brown hair, blue eyes, strong athletic build, serious determined expression.',
    costume: 'Blue-and-gold segmented tactical armor over a navy undersuit, reinforced shoulder guards, gloves, armored boots, utility belt with pouches, wrist tech device; long high-tech sword.',
    bodyLanguage: 'Disciplined, protective, decisive, emotionally reserved.',
    animationNotes: 'Controlled sword movement, tactical poses, authoritative gestures, military discipline.',
    palette: ['#2452b5', '#16224d', '#d6a93c', '#a6abb2'],
  },
  {
    id: 'voltage', name: 'Voltage', epithet: 'The Electric Speedster', gender: 'male', age: 24, anatomy: 'humanoid', role: 'ranged', power: 'bolt', flies: true,
    body: { height: 1.0, bulk: 1.08, muscle: 1.0, feminine: false, sleeves: 'full' },
    colors: { skin: '#e8bb98', suit: '#a3142f', accent: '#e06b1c', accent2: '#ffd23d', gloves: '#e06b1c', boots: '#e06b1c', belt: '#e06b1c', hair: '#f0c94a', eyes: '#3d7fe0', glow: '#ffe14a' },
    hair: 'spiky',
    parts: [{ k: 'goggles' }, { k: 'emblem', shape: 'bolt2' }, { k: 'shoulder-pads', color: '#e06b1c' }, { k: 'gauntlets', color: '#e06b1c' }, { k: 'knee-pads', color: '#1a1a1f' }],
    appearance: 'Athletic young man (185 cm), wild spiky blond hair, confident grin, glowing yellow protective goggles.',
    costume: 'Fitted crimson suit, orange armored shoulder plates, orange gauntlets, boots and utility belt, twin yellow lightning insignias on the chest.',
    bodyLanguage: 'Energetic, impulsive, confident, restless.',
    animationNotes: 'Rapid acceleration, electrical arcs, energetic hand gestures; fast and explosive movement.',
    palette: ['#a3142f', '#e06b1c', '#ffd23d', '#d4a63a'],
  },
  {
    id: 'gigantic', name: 'Gigantic', epithet: 'The Gentle Giant', gender: 'male', anatomy: 'humanoid', role: 'tank', power: 'fists', flies: false,
    body: { height: 1.42, bulk: 1.55, muscle: 1.6, feminine: false, sleeves: 'none' },
    colors: { skin: '#e8b48f', suit: '#2e8b3a', legs: '#4a6fa5', accent: '#c8312b', gloves: '#e8b48f', boots: '#7a4a24', belt: '#3a2a1c', hair: '#5a3a1e', eyes: '#5a3a1e', glow: '#9fe07a' },
    hair: 'spiky',
    parts: [{ k: 'stripes', color: '#c8312b' }],
    appearance: 'Very tall, exceptionally muscular young man; broad shoulders, massive arms, light skin, short spiky brown hair, friendly face.',
    costume: 'Sleeveless green tank top with horizontal red stripes, blue denim jeans, brown lace-up work boots.',
    bodyLanguage: 'Calm, reassuring, protective; imposing but not threatening.',
    animationNotes: 'Heavy but controlled movement; lifts enormous objects while smiling.',
    palette: ['#2e8b3a', '#c8312b', '#4a6fa5', '#7a4a24'],
  },
  {
    id: 'harkadius', name: 'Harkadius', epithet: 'The Centaur Warrior', gender: 'male', anatomy: 'centaur', role: 'melee', power: 'fists', flies: false,
    body: { height: 1.1, bulk: 1.2, muscle: 1.25, feminine: false, sleeves: 'none', bareChest: true },
    colors: { skin: '#d9a582', suit: '#d9a582', accent: '#3b2a1e', accent2: '#8a8f96', gloves: '#d9a582', boots: '#1d1a18', hair: '#1d1a18', eyes: '#4a5a6a', glow: '#c9b38a' },
    hair: 'bun',
    parts: [{ k: 'straps' }, { k: 'bracers', color: '#8a8f96' }],
    appearance: 'Powerful male centaur; muscular human torso, long dark hair in a loose bun, sharp features, large black horse body and tail.',
    costume: 'Brown leather straps crossing the bare chest, metallic forearm guards.',
    bodyLanguage: 'Disciplined, stoic, vigilant, grounded.',
    animationNotes: 'Accurate centaur anatomy; the human torso stays naturally connected while walking, galloping and fighting.',
    palette: ['#1d1a18', '#3b2a1e', '#d9a582', '#8a8f96'],
  },
  {
    id: 'hallethea', name: 'Hallethea', epithet: 'The Centaur of Harmony', gender: 'female', anatomy: 'centaur', role: 'support', power: 'heal', flies: false,
    body: { height: 1.02, bulk: 0.9, muscle: 0.85, feminine: true, sleeves: 'none' },
    colors: { skin: '#f6d6c2', suit: '#e0262b', accent: '#c9cf8a', gloves: '#e0262b', boots: '#c9cf8a', hair: '#f0d27a', eyes: '#8a8a3a', glow: '#b8ff9a' },
    hair: 'long',
    parts: [],
    appearance: 'Graceful female centaur; fair skin, delicate features, extremely long flowing blond hair, pale greenish-gold horse body.',
    costume: 'Fitted sleeveless red top and elegant red gloves.',
    bodyLanguage: 'Gentle, graceful, compassionate, composed.',
    animationNotes: 'Elegant, organic movement; subtle hair motion; natural equine locomotion.',
    palette: ['#f0d27a', '#e0262b', '#c9cf8a', '#a8b98f'],
  },
  {
    id: 'tsunami', name: 'Tsunami', epithet: 'The Water Heroine', gender: 'female', anatomy: 'humanoid', role: 'ranged', power: 'water', flies: false,
    body: { height: 0.95, bulk: 0.88, muscle: 0.82, feminine: true, sleeves: 'none', bareLegs: true, bareFeet: true },
    colors: { skin: '#a9d8f0', suit: '#3f7fcf', accent: '#5aa2d6', accent2: '#f0b48a', gloves: '#a9d8f0', boots: '#a9d8f0', hair: '#3f6fc9', hair2: '#5a8fe0', eyes: '#2a7fd0', glow: '#6fd8ff' },
    hair: 'wavy',
    parts: [{ k: 'fin-ears' }, { k: 'shells' }],
    appearance: 'Aquatic humanoid woman; light-blue skin, long wavy blue hair, blue eyes, pointed fin-like ears, gill details.',
    costume: 'Blue ocean-inspired swimsuit decorated with seashell ornaments.',
    bodyLanguage: 'Fluid, graceful, independent, serene.',
    animationNotes: 'Hair and costume move as if underwater; water forms spirals, waves and streams around her.',
    palette: ['#a9d8f0', '#3f7fcf', '#5aa2d6', '#f0b48a'],
  },
  {
    id: 'rocket-prime', name: 'Rocket Prime', epithet: 'The Human Tank', gender: 'male', anatomy: 'mecha', role: 'tank', power: 'missile', flies: false,
    body: { height: 2.3, bulk: 1.5, muscle: 1.7, feminine: false, sleeves: 'full' },
    colors: { skin: '#e8b898', suit: '#e6e8ec', sleeves: '#e6e8ec', legs: '#e6e8ec', accent: '#d0282e', accent2: '#2f5fb8', gloves: '#4a4f57', boots: '#d0282e', belt: '#4a4f57', hair: '#5a3a1e', eyes: '#3fe0ff', glow: '#3fe0ff' },
    hair: 'none',
    parts: [{ k: 'mecha-helmet' }, { k: 'missile-pods' }, { k: 'shoulder-pads', color: '#2f5fb8', trim: '#d0282e' }, { k: 'knee-pads', color: '#2f5fb8' }, { k: 'gauntlets', color: '#d0282e' }],
    appearance: 'Young brown-haired pilot with blue eyes who uses a wheelchair outside his combat armor (pilot rides inside the mecha).',
    costume: 'Huge white/red/blue Japanese-style mecha, robotic helmet with cyan sensors, shoulder-mounted missile pods.',
    bodyLanguage: 'Determined, focused, tactical, resilient.',
    animationNotes: 'Mecha moves with weight, hydraulic force and mechanical precision.',
    palette: ['#e6e8ec', '#d0282e', '#2f5fb8', '#4a4f57', '#3fe0ff'],
  },
  {
    id: 'techno', name: 'Techno', epithet: 'The Futuristic Engineer', gender: 'female', anatomy: 'humanoid', role: 'ranged', power: 'plasma', flies: false,
    body: { height: 0.96, bulk: 0.9, muscle: 0.85, feminine: true, sleeves: 'none' },
    colors: { skin: '#6b4430', suit: '#141414', legs: '#1e1e1c', accent: '#d6262b', accent2: '#f2c21b', gloves: '#141414', boots: '#141414', belt: '#3a2a1c', hair: '#1a120e', hair2: '#d6262b', eyes: '#d6262b', glow: '#3fe0ff' },
    hair: 'afro',
    parts: [{ k: 'hud-glasses' }, { k: 'mech-arm' }, { k: 'vest' }, { k: 'drones' }, { k: 'earrings' }, { k: 'knee-pads', color: '#2a2a2a' }, { k: 'cargo-pockets' }],
    appearance: 'Young Black woman, dark skin, large rounded afro with red and yellow streaks, oversized red-tinted round HUD glasses, hoop earrings.',
    costume: 'Black tactical vest with red/yellow accents, black cargo pants, boots, detailed cybernetic left arm, tech glove; small drone companions.',
    bodyLanguage: 'Intelligent, resourceful, confident, quick-thinking.',
    animationNotes: 'Holographic interfaces, articulated mechanical fingers, drones.',
    palette: ['#141414', '#d6262b', '#f2c21b', '#8d939b', '#3fe0ff'],
  },
  {
    id: 'jupiterian', name: 'Jupiterian', epithet: 'The Cosmic Messenger', gender: 'male', anatomy: 'humanoid', role: 'flyer', power: 'cosmic', flies: true,
    body: { height: 1.07, bulk: 1.02, muscle: 0.95, feminine: false, sleeves: 'full' },
    colors: { skin: '#3d2a22', suit: '#f4f6f8', accent: '#a8d4ec', accent2: '#c9a64a', gloves: '#f4f6f8', boots: '#f4f6f8', belt: '#e8eaee', hair: '#e4e8ee', eyes: '#c8d8e8', glow: '#cfe8ff' },
    hair: 'slick',
    parts: [{ k: 'planet-belt' }, { k: 'collar', color: '#f4f6f8' }],
    appearance: 'Tall athletic dark-skinned man, short neat silver-white hair, calm serious features.',
    costume: 'Sleek white bodysuit with pale-blue seams, high collar, white boots, metallic belt with planetary emblem; luminous aura.',
    bodyLanguage: 'Calm, mysterious, disciplined, dignified.',
    animationNotes: 'Subtle glow, smooth near-weightless movement, clean silhouette.',
    palette: ['#f4f6f8', '#c7ccd2', '#a8d4ec', '#c9a64a'],
  },
  {
    id: 'captain-space', name: 'Captain Space', epithet: 'The Cosmic Adventurer', gender: 'male', anatomy: 'humanoid', role: 'flyer', power: 'cosmic', flies: true,
    body: { height: 1.0, bulk: 1.08, muscle: 1.05, feminine: false, sleeves: 'full' },
    colors: { skin: '#e8bb98', suit: '#f4f6f8', accent: '#d0282e', accent2: '#2a5bc0', gloves: '#2a5bc0', boots: '#2a5bc0', belt: '#f4f6f8', hair: '#6b4428', eyes: '#3d7fe0', glow: '#b06cff' },
    hair: 'short',
    parts: [{ k: 'astronaut-helmet' }, { k: 'emblem', shape: 'star' }, { k: 'bracers', color: '#d0282e' }],
    appearance: 'Youthful athletic man, short brown hair, blue eyes, adventurous determined expression.',
    costume: 'White astronaut-style suit, blue gloves and boots, red wrist and boot bands, clear space helmet, multicolor star emblem.',
    bodyLanguage: 'Heroic, adventurous, optimistic, energetic.',
    animationNotes: 'Zero-gravity movement, cosmic particles, glowing hands, dynamic flying poses.',
    palette: ['#f4f6f8', '#d0282e', '#2a5bc0', '#b06cff'],
  },
  {
    id: 'size', name: 'Size', epithet: 'The Size-Changing Teenage Hero', gender: 'male', age: 15, anatomy: 'humanoid', role: 'melee', power: 'fists', flies: false,
    body: { height: 0.86, bulk: 0.92, muscle: 0.88, feminine: false, sleeves: 'full' },
    colors: { skin: '#f0c4a0', suit: '#8b1fd1', accent: '#f5d21a', gloves: '#f5d21a', boots: '#f5d21a', belt: '#8b1fd1', hair: '#6b4428', eyes: '#6b4428', glow: '#c98bff' },
    hair: 'none',
    parts: [{ k: 'antenna-helmet' }],
    appearance: 'Teenage boy, short brown hair, expressive brown eyes, youthful athletic build.',
    costume: 'Bright purple full-body suit, purple helmet with two long silver antennae, yellow gloves, yellow boots.',
    bodyLanguage: 'Playful, adventurous, courageous, enthusiastic.',
    animationNotes: 'Seamless growing/shrinking while preserving proportions; antennae always visible.',
    palette: ['#8b1fd1', '#f5d21a', '#b9bec6', '#2b8fe8'],
  },
  {
    id: 'melody', name: 'Melody', epithet: 'The Musical Superheroine', gender: 'female', anatomy: 'humanoid', role: 'ranged', power: 'sonic', flies: false,
    body: { height: 0.95, bulk: 0.86, muscle: 0.8, feminine: true, sleeves: 'short', bareLegs: true },
    colors: { skin: '#f3cdb6', suit: '#b3194a', sleeves: '#d63fb0', accent: '#5b1f8f', accent2: '#d4a63a', gloves: '#6a2aa8', boots: '#6a2aa8', belt: '#d4a63a', hair: '#6a2d6e', hair2: '#8a3d8e', eyes: '#9a5ad8', glow: '#ff7ae0' },
    hair: 'wavy',
    parts: [{ k: 'eye-mask', color: '#6a2aa8' }, { k: 'skirt', style: 'tutu' }, { k: 'mic' }, { k: 'emblem', shape: 'notes' }],
    appearance: 'Glamorous young woman, long wavy purple hair, violet eyes, theatrical look.',
    costume: 'Sparkling crimson/deep-purple performance dress with layered skirt and gold trim, long purple gloves, purple high-heeled boots, purple masquerade mask, handheld microphone.',
    bodyLanguage: 'Expressive, theatrical, graceful, charismatic.',
    animationNotes: 'Performance gestures, rhythmic movement, flowing fabric, sparkles.',
    palette: ['#b3194a', '#5b1f8f', '#d63fb0', '#d4a63a'],
  },
  {
    id: 'maltese-cross', name: 'Maltese Cross', epithet: 'The Veteran Super-Soldier', gender: 'male', anatomy: 'humanoid', role: 'tank', power: 'shield', flies: false,
    body: { height: 1.04, bulk: 1.25, muscle: 1.2, feminine: false, sleeves: 'full' },
    colors: { skin: '#e2b08e', suit: '#f2f2f2', sleeves: '#f2f2f2', legs: '#c8262b', accent: '#c8262b', gloves: '#f2f2f2', boots: '#f2f2f2', belt: '#6b4528', hair: '#c9b68a', eyes: '#4a7fc0', glow: '#ffffff' },
    hair: 'slick',
    parts: [{ k: 'maltese-shield' }, { k: 'emblem', shape: 'cross' }, { k: 'shoulder-pads', color: '#c8262b' }, { k: 'collar', color: '#c8262b' }],
    appearance: 'Mature heavily built man, short swept-back gray-blond hair, blue eyes, square jaw, stern expression.',
    costume: 'Red-and-white uniform with red Maltese cross on a white chest, red shoulders, white gloves and boots, brown utility belt; red heater shield with white Maltese cross and metal rim.',
    bodyLanguage: 'Disciplined, authoritative, stoic, experienced.',
    animationNotes: 'Grounded combat, powerful shield techniques, restrained expressions.',
    palette: ['#c8262b', '#f2f2f2', '#6b4528', '#a6abb2'],
  },
  {
    id: 'captain-phoenix', name: 'Captain Phoenix', epithet: 'The Fire-Winged Warrior', gender: 'male', anatomy: 'humanoid', role: 'flyer', power: 'fire', flies: true,
    body: { height: 1.06, bulk: 1.22, muscle: 1.2, feminine: false, sleeves: 'full' },
    colors: { skin: '#e2a882', suit: '#c0391c', legs: '#8f1a14', accent: '#d4a63a', gloves: '#d4a63a', boots: '#c0391c', belt: '#d4a63a', hair: '#ff6a1a', hair2: '#ffd23d', eyes: '#ffb020', glow: '#ff8a1a' },
    hair: 'flame',
    parts: [{ k: 'wings', style: 'flame' }, { k: 'phoenix-helmet' }, { k: 'emblem', shape: 'phoenix' }, { k: 'shoulder-pads', color: '#d4a63a' }, { k: 'gauntlets', color: '#d4a63a' }, { k: 'knee-pads', color: '#d4a63a' }],
    appearance: 'Muscular man with flame-shaped red-orange hair, intense eyes, intimidating expression.',
    costume: 'Red-and-gold armor with phoenix chest emblem, metallic shoulders, gauntlets, boots, gold helmet guard; two huge flaming wings.',
    bodyLanguage: 'Fierce, powerful, dramatic, commanding.',
    animationNotes: 'Stylized flames, glowing wings that expand in flight and combat, dramatic aerial movement.',
    palette: ['#f2701c', '#8f1a14', '#d4a63a', '#ffe14a'],
  },
  {
    id: 'dragon-ceasar', name: 'Dragon Ceasar', epithet: 'The Dragon Warrior', gender: 'male', anatomy: 'dragon', role: 'melee', power: 'fists', flies: false,
    body: { height: 1.08, bulk: 1.2, muscle: 1.18, feminine: false, sleeves: 'none' },
    colors: { skin: '#3f8a3a', suit: '#e3701f', legs: '#1e2a22', accent: '#16a35a', accent2: '#e3701f', gloves: '#3f8a3a', boots: '#e3701f', belt: '#5a2a14', hair: '#2a63c4', eyes: '#ff2a2a', glow: '#2aff8a' },
    hair: 'ponytail',
    parts: [{ k: 'dragon-head' }, { k: 'dragon-tail' }, { k: 'emblem', shape: 'gem' }, { k: 'shoulder-pads', color: '#e3701f', trim: '#16a35a' }, { k: 'gauntlets', color: '#e3701f' }, { k: 'skirt', style: 'tabard' }, { k: 'knee-pads', color: '#e3701f' }],
    appearance: 'Anthropomorphic dragon; green scales, reptilian snout, red eyes, long blue ponytail, two red horns, pointed ears, claws, long tail.',
    costume: 'Orange martial-arts armor with green patterns and an emerald gem, shoulder guards, gauntlets, leg armor, loose dark trousers.',
    bodyLanguage: 'Focused, honorable, disciplined, agile.',
    animationNotes: 'Fluid kung-fu choreography, expressive tail, reptilian facial animation.',
    palette: ['#3f8a3a', '#e3701f', '#2a63c4', '#b02a22', '#16a35a'],
  },
  {
    id: 'lady-astral', name: 'Lady Astral', epithet: 'The Cosmic Warrior-Princess', gender: 'female', anatomy: 'humanoid', role: 'ranged', power: 'cosmic', flies: false,
    body: { height: 1.04, bulk: 0.9, muscle: 0.85, feminine: true, sleeves: 'full' },
    colors: { skin: '#f6dcd0', suit: '#dfe3ea', accent: '#ff4fc8', accent2: '#9a6bff', gloves: '#cfd3da', boots: '#cfd3da', hair: '#ff7ad8', hair2: '#9a6bff', eyes: '#d08aff', glow: '#ff9af0' },
    hair: 'ponytail',
    parts: [{ k: 'horn' }, { k: 'galaxy-cape' }, { k: 'shoulder-pads', color: '#dfe3ea', trim: '#ff4fc8' }, { k: 'gauntlets', color: '#cfd3da' }],
    appearance: 'Beautiful, athletic, fully humanoid woman (two human arms, two human legs — never a centaur); fair skin, long pink-to-purple hair in a high ponytail, delicate features, a single luminous horn centered on her forehead.',
    costume: 'Elegant silver-white cosmic armor with neon-pink and violet accents, armored gloves, protective shoulder plates, sleek armored boots, long flowing cape with a shimmering galaxy pattern.',
    bodyLanguage: 'Regal, graceful, courageous, composed, emotionally expressive.',
    animationNotes: 'Fully bipedal. Elegant combat movement, flowing hair, cape motion, luminous horn, cosmic particles. CRITICAL: exactly two human legs and two human arms; the single horn stays centered on the forehead.',
    palette: ['#cfd3da', '#f4f6f8', '#ff4fc8', '#9a6bff', '#4b2a8f'],
  },
  {
    id: 'symbol', name: 'Symbol', epithet: 'The Synthetic Angel', gender: 'male-presenting synthetic', anatomy: 'humanoid', role: 'flyer', power: 'plasma', flies: true,
    body: { height: 1.04, bulk: 0.96, muscle: 0.9, feminine: false, sleeves: 'full' },
    colors: { skin: '#dfe3ea', suit: '#16234f', accent: '#5fe3ff', accent2: '#c7ccd2', gloves: '#dfe3ea', boots: '#16234f', belt: '#16234f', hair: '#efe0a8', eyes: '#2a2a33', glow: '#5fe3ff' },
    hair: 'curly',
    parts: [{ k: 'wings', style: 'mech' }, { k: 'emblem', shape: 'sigil' }],
    appearance: 'Slender pale artificial humanoid, short curly platinum-blond hair, sharp features, restrained expression.',
    costume: 'Dark-navy full-body suit with a glowing geometric chest symbol; huge mechanical blade-feather wings.',
    bodyLanguage: 'Precise, controlled, mysterious, detached.',
    animationNotes: 'Articulated mechanical wings, smooth robotic movement, subtle cyan light.',
    palette: ['#16234f', '#c7ccd2', '#f4f6f8', '#5fe3ff'],
  },
  {
    id: 'comrade', name: 'Comrade', epithet: 'The Young Antihero', gender: 'male', anatomy: 'humanoid', role: 'melee', power: 'fists', flies: false,
    body: { height: 0.98, bulk: 0.98, muscle: 0.92, feminine: false, sleeves: 'short' },
    colors: { skin: '#eac0a0', suit: '#d6262b', legs: '#9a1a32', accent: '#2c4f9a', gloves: '#2c4f9a', boots: '#2c4f9a', belt: '#9a1a32', hair: '#7a4a28', eyes: '#6b4428', glow: '#ff5a3a' },
    hair: 'messy',
    parts: [{ k: 'birthmark' }, { k: 'cargo-pockets' }],
    appearance: 'Young man, messy chestnut-brown hair, lean build, serious expression, large reddish birthmark around one eye.',
    costume: 'Red short-sleeved shirt, crimson cargo pants, dark-blue gloves, blue combat boots.',
    bodyLanguage: 'Defensive, stubborn, emotionally guarded, determined.',
    animationNotes: 'Expressive face; the birthmark must stay consistent in every shot; natural human movement.',
    palette: ['#d6262b', '#9a1a32', '#2c4f9a', '#6b4528'],
  },
  {
    id: 'mariposa', name: 'Mariposa', epithet: 'The Fairy Superheroine', gender: 'female', age: 15, anatomy: 'humanoid', role: 'support', power: 'nature', flies: true,
    body: { height: 0.84, bulk: 0.8, muscle: 0.75, feminine: true, sleeves: 'none', bareLegs: true },
    colors: { skin: '#f6d6c2', suit: '#f08a1c', accent: '#3fa63a', accent2: '#8a4fd8', gloves: '#7aff9a', boots: '#3fbf6a', hair: '#f0d27a', eyes: '#2aa05a', glow: '#7aff9a' },
    hair: 'long',
    parts: [{ k: 'wings', style: 'butterfly' }, { k: 'skirt', style: 'leaf' }],
    appearance: 'Teenage fairy girl, fair skin, long flowing blond hair, green eyes, delicate build.',
    costume: 'Sparkling orange bodice, layered green leaf skirt with an iridescent purple-blue underlayer, translucent green gloves, green fantasy boots; four large iridescent butterfly wings.',
    bodyLanguage: 'Curious, sensitive, hopeful, occasionally uncertain.',
    animationNotes: 'Delicate wing flutter, magic particles, soft iridescence; light youthful movement.',
    palette: ['#f08a1c', '#3fa63a', '#8a4fd8', '#3fd0c8', '#f07ac0'],
  },
  {
    id: 'enforcer', name: 'Enforcer', epithet: 'The Shadow Warrior', gender: 'female', anatomy: 'humanoid', role: 'melee', power: 'blade', flies: false,
    body: { height: 0.97, bulk: 0.9, muscle: 0.85, feminine: true, sleeves: 'full' },
    colors: { skin: '#e8c0a4', suit: '#141418', sleeves: '#6a6e76', legs: '#141418', accent: '#b3141c', accent2: '#3a3d44', gloves: '#141418', boots: '#141418', belt: '#1e1e22', hair: '#0d0d10', eyes: '#3a2a22', glow: '#ff3a3a' },
    hair: 'long',
    parts: [{ k: 'hood' }, { k: 'ninja-mask' }, { k: 'katana' }, { k: 'emblem', shape: 'triangle' }, { k: 'chainmail' }, { k: 'gauntlets', color: '#24242a' }, { k: 'knee-pads', color: '#24242a' }],
    appearance: 'Athletic young woman, long straight black hair, intense eyes, lower face hidden by a dark ninja mask.',
    costume: 'Black tactical ninja outfit: hood, face mask, segmented armor, chainmail sleeves, armored forearms, shin guards, black boots, red triangular chest emblem; katana.',
    bodyLanguage: 'Silent, agile, observant, precise, intimidating.',
    animationNotes: 'Stealthy fast movement, fluid sword combat, subtle eye expression. Female — keep her feminine athletic silhouette.',
    palette: ['#0d0d10', '#3a3d44', '#b9bec6', '#b3141c'],
  },
];

export const HERO_BY_ID: Record<string, HeroSpec> = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const ALLY_IDS = HEROES.filter((h) => h.id !== 'paladin' && h.id !== 'voltage').map((h) => h.id);
