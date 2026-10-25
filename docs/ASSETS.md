# Replacing placeholder heroes with original Compass Alliance models

Every hero is currently a procedural, stylized placeholder generated from data in
`src/characters/heroes.ts` by `src/characters/buildHero.ts`. You can swap any single hero for a
real 3D model without touching the story, simulation or camera code.

## 1. Export the model

- Format: **GLB** (binary glTF 2.0), one file per hero, with the skeleton and animation clips embedded.
- Orientation: the character faces **+Z**, Y up, feet at the origin. If not, set `yawOffset`.
- Scale: about **1.85 units tall** for an adult (1 unit = 1 m). Use `scale` to adjust.
- Keep each hero under ~40k triangles and 4 materials. Twenty heroes can be on screen at once.
- Suggested clips: `Idle`, `Run`, `Fly`, `Cast`, `Jump`, `Slash`/`Punch`, `Block`, `Fall`, `Land`,
  plus `Gallop` for centaurs and `Lift` for Gigantic.

## 2. Add the file

Put it in `public/models/`, for example `public/models/paladin.glb`.

## 3. Register it

In `src/config/characters.ts`:

```ts
export const MODEL_OVERRIDES = {
  paladin: {
    model: '/models/paladin.glb',
    scale: 1,
    yawOffset: 0,
    clips: { idle: 'Idle', run: 'Run', shield: 'Block', leap: 'Jump', punch: 'Slash', fall: 'Fall', land: 'Land' },
  },
};
```

`clips` maps the simulation's animation states (`HeroAnim` in `src/battle/BattleSim.ts`) to the clip names
in your file. Unmapped states fall back to `idle`. The loader (`src/scene/characters/GltfCharacter.tsx`)
cross-fades between clips. Signature effects (Paladin's barrier, Voltage's arcs, auras) still render around the model.

> Status: the GLB path is implemented but has not been tested against a real model yet, because none ship with the project.

## 4. Camera framing

Close-ups use the eye-line height from `headHeight()` in `buildHero.ts`, computed from `body.height`.
If your model's proportions differ, adjust `body.height` for that hero in `heroes.ts`.

## Keeping characters on-model

`heroes.ts` holds the canonical visual reference for each hero (appearance, costume, palette, body
language, animation notes), taken from the character sheets. Give it to artists together with the
original sheets. Rules that must always hold:

- **Lady Astral** is fully humanoid: two arms and two legs, never a centaur. Her single horn is centred on her forehead.
- **Enforcer** is female. Keep her feminine, athletic silhouette.
- **Comrade's** birthmark stays on the same side in every shot.
- **Size's** antennae stay visible at every scale.
- **Rocket Prime** is a pilot inside a mecha. Keep the two clearly distinct.
