# Voidbox

A 2D physics ragdoll sandbox in the spirit of People Playground. Grey crash-test dummies stand in a black void. Throw them, shoot them, stab them, set them on fire and blow them up, and they react: they bleed (purple), break bones, get concussed, black out, clutch their wounds and try to get back on their feet.

Runs entirely in the browser. No build step needed to play.

## Play

- Open `index.html` in a browser (works straight from `file://`), or
- open the single-file build `dist/voidbox.html`, which has everything inlined and works offline.

## Controls

| Action | Input |
| --- | --- |
| Grab and throw | Left-drag |
| Use held item (fire, toggle blade, pull pin) | `Space` / `F` (hold for automatic weapons) |
| Use item under the cursor / inspect a dummy | Right-click |
| Rotate held item | `Q` `E` or mouse wheel |
| Pan / zoom | Right-drag or drag empty space, `WASD` / wheel, pinch on touch |
| Flip / rotate before placing | `F` / `Q` `E` |
| Place several copies | `Shift` + click |
| Tools: Grab, Pin, Rope, Explode, Ignite, Heal, Delete | `1` to `7` |
| Pause, slow motion, health overlay | `P`, `T`, `L` |
| Spawn a dummy at the cursor | `G` |
| Spawn the last item you picked from the catalog again | `R` |
| Drive a tank | Right-click it, then `A` `D` drive, `W` `S` aim the gun, `Space` fire, `Esc` get out |
| Clear blood and debris | `C` |
| Delete under cursor | `X` / `Del` |

On touch screens a round **Use** button activates the item you are holding.

## What's in the box

**Dummies.** Thirteen-part articulated ragdolls (head, chest, abdomen, upper and lower arms, thighs, shins, feet) with joint limits and muscle motors. Conscious dummies balance and stand, get back up after being knocked down, flail when airborne, writhe in pain and reach for their worst bleeding wound with a free hand.

Each body part tracks tissue damage, fractures, wounds and burns. The dummy as a whole tracks blood volume, brain health, pain and consciousness:

- **Gunshots.** Entry and exit wounds, penetration through several bodies, chance of fractures, headshots.
- **Blades.** Lacerations, stab wounds, impalement (weapons stay stuck and can be pulled out) and dismemberment.
- **Blunt trauma.** Concussions and knockouts, skull fractures, broken necks, fractured limbs and ribs.
- **Falls and slams.** Deceleration trauma, internal bleeding and leg fractures from hard landings.
- **Fire.** Spreads between limbs and wood, chars skin and causes shock.
- **Blood loss.** Pulses with the heartbeat, clots over time and leads to fainting and death.

Broken legs mean no standing. Severe pain causes shock, and a damaged brain means coma. Click a dummy to open the inspector with vitals, a body map and an injury log.

**Melee.** Combat knife, longsword, katana, fire axe, spear, jousting lance, sledgehammer, baseball bat, crowbar, chainsaw.

**Firearms.** Pistol, .44 revolver, SMG, assault rifle, pump shotgun, .50 cal sniper, minigun (spin-up), crossbow (pins targets), flamethrower.

**Explosives.** Frag grenade (shrapnel), C4 (sticky, timed), landmine, RPG, explosive barrel (chain reactions), Molotov.

**Sci-fi.** Energy sword, laser sword, plasma grenade (sticky), singularity grenade (black hole), railgun, plasma rifle, gravity gun.

**Gadgets.** Life syringe (heals and revives), adrenaline, sedative, sentry turret, hanging lamp.

**Tanks.** M4 Sherman, Tiger I and Leopard 2, each spawned with a crew of four. Hulls are bolted together from separate armour plates on a frame with sprung road wheels and treads, so plates dent, get holed and fall off. Every plate has a real thickness (Sherman 63 mm sloped glacis, Tiger 100 mm flat front, Leopard 600 mm composite), and shells compare their penetration against the plate's thickness and impact angle. A penetrating shell explodes inside, can set the crew on fire and sometimes cooks off the ammunition and throws the turret off. Shallow hits ricochet. A tank needs its driver to move and a gunner to fire.

**Props and buildings.** Crates (breakable, flammable), steel crate, plank, brick, concrete block, steel ball, tyre, table, chair, glass pane (shatters into sharp shards), ramp, fixed platform, wall, spike strip, a destructible house and a 12 m watchtower.

## Project layout

```
index.html          page shell, UI markup and styles
js/core.js          world, materials, entities, contact handling, particles, sim step
js/ragdoll.js       dummy anatomy, balance controller, physiology and injuries
js/combat.js        bullets, beams, blades, impalement, explosions, fire
js/items.js         every spawnable item, the turret, house and tower
js/tanks.js         plate-built tanks, crews, armour penetration and driving
js/render.js        camera and canvas rendering
js/ui.js            input, tools, catalog, inspector
js/audio.js         synthesized sound effects (WebAudio, no assets)
js/main.js          boot, starting scene and main loop
js/vendor/          planck.js 1.4.3 (Box2D port, MIT)
tools/build.mjs     bundles everything into dist/voidbox.html
```

Physics runs at a fixed 120 Hz on [planck.js](https://github.com/piqnt/planck.js). Rebuild the single-file version after changing code:

```bash
node tools/build.mjs
```
