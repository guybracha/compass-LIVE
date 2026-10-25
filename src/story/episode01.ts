import { HERO_BY_ID } from '../characters/heroes';
import { scene } from './builder';
import type { Episode, Scene } from './types';

// Pilot episode: "The Battle of Earth City".
// Story content is limited to the supplied premise; all dialogue is original.

const breakingNews: Scene = scene()
  .add({ type: 'overlay', mode: 'studio' })
  .cam('establishing')
  .sfx('alert')
  .add({ type: 'music', mood: 'tense' })
  .add({ type: 'banner', text: 'BREAKING NEWS' })
  .wait(1.6)
  .add({ type: 'lowerThird', name: 'NEWS ANCHOR', title: 'Compass Alliance: LIVE', hold: 4 })
  .line('anchor', 'n01', 'We interrupt our regular programming with breaking news.')
  .add({ type: 'banner', text: 'ATTACK ON EARTH CITY' })
  .line('anchor', 'n02', 'A massive machine is moving through downtown Earth City.')
  .line('anchor', 'n03', 'We go live now to our helicopter over the financial district.', 0.2)
  .add({ type: 'overlay', mode: 'field' })
  .cam('heli')
  .sfx('heliStart')
  .wait(0.6)
  .add({ type: 'lowerThird', name: 'FIELD REPORTER', title: 'Live — Sky 7 Helicopter', hold: 3.5 })
  .line('reporter', 'r01', 'This is unbelievable. It is walking right down Central Avenue!')
  .cam('robotLow', 0)
  .event('robotSwipe')
  .add({ type: 'alert', text: 'EMERGENCY ALERT: SHELTER IN PLACE', hold: 3.5 })
  .line('reporter', 'r02', 'Buildings are coming apart. People are still on the streets!')
  .cam('tracking', 1.2)
  .wait(1.2)
  .scene('breaking', 'Breaking News', { tail: 0.3, next: 'heroes' });

const heroesArrive: Scene = scene()
  .cam('horizon', 0)
  .line('reporter', 'r03', 'Wait... something is coming down from the sky!')
  .event('heroesLand')
  .cam('heroLanding', 0)
  .wait(1.4)
  .add({ type: 'banner', text: 'COMPASS ALLIANCE ON SCENE' })
  .add({ type: 'music', mood: 'tense' })
  .cam('closePaladin', 0)
  .add({ type: 'lowerThird', name: 'PALADIN', title: 'Leader — Compass Alliance', hold: 4 })
  .line('paladin', 'p01', 'Voltage, hold position. There are still people on these streets.')
  .cam('closeVoltage', 0)
  .add({ type: 'lowerThird', name: 'VOLTAGE', title: 'Compass Alliance', hold: 3.5 })
  .line('voltage', 'v01', 'That thing is tearing the city apart. I can drop it right now.')
  .cam('otsVoltage', 0)
  .line('paladin', 'p02', 'If we fight here, they get caught in the crossfire. We evacuate first.')
  .cam('otsPaladin', 0)
  .line('voltage', 'v02', 'Every second we wait, it levels another block!')
  .event('robotRoar')
  .cam('robotLow', 0)
  .wait(0.8)
  .cam('lowAngleHero', 1.5)
  .line('reporter', 'r04', 'The heroes appear to disagree on what to do next...')
  .scene('heroes', 'Heroes Arrive', { tail: 0.2, next: 'decision' });

const decision: Scene = scene()
  .cam('wideBattle', 1.2)
  .add({ type: 'banner', text: 'YOU DECIDE: HOW SHOULD THEY RESPOND?' })
  .add({
    type: 'choice',
    prompt: 'How should Compass Alliance respond?',
    timeout: 10,
    defaultId: 'evacuate',
    options: [
      {
        id: 'evacuate',
        label: 'EVACUATE CIVILIANS',
        hero: 'PALADIN',
        description: 'Shield the streets and get people out before engaging.',
        color: '#3d8bff',
      },
      {
        id: 'attack',
        label: 'ATTACK THE ROBOT',
        hero: 'VOLTAGE',
        description: 'Hit the machine hard, right now, with everything.',
        color: '#ffd23d',
      },
    ],
  })
  .scene('decision', 'Viewer Decision', { tail: 0.1, next: (b) => `battle_${b}` });

const PROTECTORS = ['gigantic', 'maltese-cross', 'hallethea', 'harkadius', 'mariposa', 'comrade', 'enforcer', 'tsunami', 'rocket-prime'].map((id) => HERO_BY_ID[id]);
const STRIKERS = ['captain-phoenix', 'symbol', 'captain-space', 'jupiterian', 'dragon-ceasar', 'techno', 'melody', 'lady-astral', 'size'].map((id) => HERO_BY_ID[id]);

const battleEvacuate: Scene = scene()
  .event('beginEvacuate')
  .add({ type: 'banner', text: 'EVACUATION UNDERWAY ON CENTRAL AVENUE' })
  .add({ type: 'missionStatus', visible: true })
  .add({ type: 'music', mood: 'battle' })
  .cam('shieldClose', 0)
  .line('paladin', 'p10', 'Barrier up! Everyone behind me. Move, now!')
  .event('alliesArrive')
  .cam('alliesWide', 0)
  .add({ type: 'banner', text: 'ALL COMPASS ALLIANCE UNITS RESPONDING' })
  .line('reporter', 'r13', 'Wait... that is the entire Compass Alliance!')
  .rollCall(PROTECTORS, 1.15)
  .line('voltage', 'v10', 'Fine. We clear the streets first. Fast.')
  .line('reporter', 'r10', 'They are holding the line while civilians run for cover!')
  .afterRoll()
  .cam('heli', 0)
  .wait(1.5)
  .cam('shieldClose', 0)
  .line('paladin', 'p11', 'It is focusing on me. Good. Keep them moving!')
  .cam('voltageTrack', 0)
  .line('voltage', 'v11', 'Last group is out! Now can we hit it?')
  .cam('lowAngleHero', 0)
  .line('paladin', 'p12', 'Now. Everyone, together!')
  .event('counter')
  .add({ type: 'banner', text: 'COMPASS ALLIANCE COUNTER-ATTACK' })
  .rollCall(STRIKERS, 1.0)
  .line('reporter', 'r14', 'Every hero in the Alliance is in this fight now!')
  .afterRoll()
  .cam('wideBattle', 0)
  .wait(2)
  .cam('robotLow', 0)
  .wait(1.5)
  .cam('heli', 0)
  .line('reporter', 'r11', 'They are pushing it back! It is retreating!')
  .event('retreat')
  .cam('horizon', 2)
  .wait(3.5)
  .scene('battle_evacuate', 'Battle — Evacuate', { tail: 0.3, next: 'ending_evacuate' });

const endingEvacuate: Scene = scene()
  .add({ type: 'music', mood: 'hopeful' })
  .add({ type: 'banner', text: 'CIVILIANS SAFE — MACHINE RETREATS' })
  .add({
    type: 'ending',
    info: {
      headline: 'CIVILIANS SAFE — MACHINE ESCAPES',
      subhead: 'Compass Alliance protects Central Avenue; attacker withdraws into the fog',
      cliffhanger: 'A second, unidentified signal is approaching Earth City.',
      tone: 'hopeful',
    },
  })
  .add({ type: 'ticker', text: 'LATEST — Central Avenue evacuated  •  Minimal structural damage reported  •  Machine last seen heading north  •  Compass Alliance remains on alert' })
  .add({ type: 'missionStatus', visible: false })
  .cam('lowAngleHero', 1.5)
  .line('anchor', 'n10', 'Tonight, the people of Central Avenue are safe. But the machine got away.')
  .cam('closePaladin', 0)
  .line('paladin', 'p13', 'It was not trying to win. It was testing us.')
  .event('secondSignal')
  .sfx('radar')
  .add({ type: 'alert', text: 'UNIDENTIFIED SIGNAL DETECTED', hold: 4 })
  .cam('horizon', 1.5)
  .line('reporter', 'r12', 'Wait... we are picking up a second signal. Something else is coming.')
  .wait(1)
  .scene('ending_evacuate', 'Ending — Evacuate', { tail: 0.5 });

const battleAttack: Scene = scene()
  .event('beginAttack')
  .add({ type: 'banner', text: 'COMPASS ALLIANCE ENGAGES THE MACHINE' })
  .add({ type: 'missionStatus', visible: true })
  .add({ type: 'music', mood: 'battle' })
  .cam('voltageTrack', 0)
  .line('voltage', 'v20', 'Finally! Let us light it up!')
  .event('alliesArrive')
  .cam('alliesWide', 0)
  .add({ type: 'banner', text: 'ALL COMPASS ALLIANCE UNITS ENGAGING' })
  .line('reporter', 'r24', 'And here comes the rest of the Compass Alliance!')
  .rollCall(STRIKERS, 1.0)
  .line('reporter', 'r20', 'Voltage is throwing everything he has at it!')
  .line('reporter', 'r21', 'Debris is falling onto the streets below!')
  .afterRoll()
  .rollCall(PROTECTORS, 0.95)
  .line('reporter', 'r25', 'Fire, missiles, steel... Central Avenue is a war zone!')
  .afterRoll()
  .cam('closePaladin', 0)
  .line('paladin', 'p20', 'Voltage! The buildings! There are people down there!')
  .cam('tracking', 1.2)
  .line('voltage', 'v21', 'It is almost down. Give me one more shot!')
  .cam('voltageTrack', 0)
  .event('chargeFinal')
  .add({ type: 'banner', text: 'MAXIMUM CHARGE DETECTED' })
  .wait(2.2)
  .event('finalBlast')
  .cam('wideBattle', 0)
  .wait(1.6)
  .cam('robotDown', 1.5)
  .line('reporter', 'r22', 'It is down! The machine is down!')
  .wait(1.5)
  .scene('battle_attack', 'Battle — Attack', { tail: 0.3, next: 'ending_attack' });

const endingAttack: Scene = scene()
  .add({ type: 'music', mood: 'grim' })
  .add({ type: 'banner', text: 'MACHINE DOWN ON CENTRAL AVENUE' })
  .add({
    type: 'ending',
    info: {
      headline: 'MACHINE DOWN — DISTRICT IN RUINS',
      subhead: 'Voltage stops the attacker; heavy damage across Central Avenue',
      cliffhanger: 'The fallen machine’s core has reactivated — and it is transmitting.',
      tone: 'grim',
    },
  })
  .add({ type: 'ticker', text: 'LATEST — Attacker neutralized on Central Avenue  •  Widespread structural damage  •  Rescue crews searching collapsed blocks  •  Officials question the response' })
  .add({ type: 'missionStatus', visible: false })
  .cam('heli', 1.5)
  .line('anchor', 'n20', 'The machine has been stopped. But the cost to Central Avenue is severe.')
  .cam('closeVoltage', 0)
  .line('voltage', 'v22', 'We won. That is what matters... right?')
  .event('reactivate')
  .sfx('transmit')
  .add({ type: 'alert', text: 'WARNING: ENERGY SPIKE AT IMPACT SITE', hold: 4 })
  .cam('robotDown', 1)
  .line('reporter', 'r23', 'Its core is glowing again... it is transmitting something!')
  .wait(1)
  .scene('ending_attack', 'Ending — Attack', { tail: 0.5 });

export const episode01: Episode = {
  id: 'ep01',
  title: 'The Battle of Earth City',
  subtitle: 'Pilot Episode',
  firstScene: 'breaking',
  scenes: Object.fromEntries(
    [breakingNews, heroesArrive, decision, battleEvacuate, endingEvacuate, battleAttack, endingAttack].map((s) => [s.id, s]),
  ),
};
