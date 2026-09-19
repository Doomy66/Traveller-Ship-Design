# Ship Design Specification

One ship, designed to the sequence in Mongoose Traveller 2nd Edition, *High Guard Update 2022*, and the sheet that falls out of it.

Clauses are numbered so they can be cited from code and tests. Page numbers are PDF pages of the High Guard file named in [Info/Rules-Source.md](Info/Rules-Source.md); the printed page is one less. *Core* means the *Traveller Core Rulebook Update 2022*, cited only where High Guard itself points there.

## Contents

1. [Purpose](#1-purpose)
2. [Terms](#2-terms)
3. [The design](#3-the-design)
4. [The sequence](#4-the-sequence)
5. [The sheet](#5-the-sheet)
6. [Problems](#6-problems)
7. [Fixtures](#7-fixtures)
8. [Saving](#8-saving)
9. [Open questions](#9-open-questions)

---

## 1. Purpose

1.1 A **design** is what the designer chose: a hull, drives, a power plant, and everything installed in it. A **sheet** is what the rules say that design is: tons, cost and power per component, hull points, crew, fuel, cargo, purchase price, monthly maintenance, and any way in which the design breaks a rule.

1.2 `sheet(design)` is a pure function. Same design, same sheet, no state, no user interface. Everything the application shows is read off a sheet.

1.3 The rules are data first. Every table in the book is transcribed once, under `src/rules/`, and each entry says which PDF page it came from. The engine reads the tables; it does not restate them.

1.3.1 A table entry is the book's figure, not a convenient one. Where the book is ambiguous the choice is written down here, in the clause that uses it, and nowhere else.

1.4 The book's own ships are the acceptance tests (section 7). A rule that makes a fixture come out wrong is wrong, or the fixture is a known erratum and says so.

## 2. Terms

2.1 **Tons** are displacement tons throughout. **MCr** is millions of credits; costs are held in MCr and shown in whatever unit reads best. **TL** is Tech Level.

2.2 **Small craft** are under 100 tons and have no jump drive. **Starships** have a jump drive. **Capital ships** are over 5,000 tons. The crew, weapon and bridge rules each draw these lines slightly differently, and each clause below says where.

2.3 **Streamlined** has three values: yes, partial, no. It is a property of the hull configuration (4.1.3) and several later rules read it.

2.4 The **design TL** is the TL of the shipyard. It caps every component and is the TL of the ship (page 9).

## 3. The design

3.1 A design is one JSON-serialisable object. Its fields are the choices the sequence in section 4 asks for, in the same order. Anything the rules can work out is not stored.

3.2 Fields:

| Field | Holds | Clause |
|---|---|---|
| `name`, `tl`, `standardDesign`, `military` | Identity, shipyard TL, whether the 10% standard-design discount applies, and which crew column to read | 2.4, 4.13, 4.10 |
| `hull` | Tons, configuration, specialised hull flags, hull options | 4.1 |
| `armour` | Type and protection, or absent | 4.2 |
| `manoeuvre`, `reaction`, `jump` | Thrust, thrust and hours, jump rating; each optional | 4.3 |
| `powerPlant` | Type, tons, weeks of fuel | 4.4, 4.5 |
| `fuel.extraTons` | Fuel beyond what the drives need | 4.5 |
| `bridge` | Standard, smaller, cockpit or dual cockpit; command and holographic flags | 4.6 |
| `computer` | Model, `/bis`, `/fib` | 4.7 |
| `sensors` | Grade | 4.8 |
| `weapons[]` | Mounts, each with its weapons | 4.9 |
| `craft[]` | Carried small craft and vehicles, each with how it is berthed | 4.11 |
| `systems[]` | Optional systems | 4.11 |
| `staterooms`, `lowBerths`, `emergencyLowBerths`, `commonAreas` | Accommodation | 4.12 |
| `passengers` | High, middle and low passengers the ship is meant to carry, for the steward and medic rules | 4.10 |
| `software[]` | Packages and their levels | 4.7 |

3.3 A field that is absent means "none", never a default the rules did not give. The one exception is the power plant, which every ship has.

## 4. The sequence

The thirteen steps of the checklist on page 10, each with the rule it applies and the page it is on.

### 4.1 Create a hull (pages 11-15)

4.1.1 A hull is at least 5 tons; a hull with a jump drive is at least 100 tons. The book asks for round numbers and the application does not enforce it.

4.1.2 A basic hull costs Cr50000 per ton. Hull points are the tons divided by 2.5, or by 2 from 25,000 tons, or by 1.5 from 100,000 tons, then rounded down after the modifiers of 4.1.3 and 4.1.4 are applied.

4.1.3 The **configuration** (page 12) sets streamlining and three modifiers, all applied as percentages of the base figure:

| Configuration | Streamlined | Armour volume | Hull points | Hull cost |
|---|---|---|---|---|
| Standard | partial | 0 | 0 | 0 |
| Streamlined | yes | +20% | 0 | +20% |
| Sphere | partial | −10% | 0 | +10% |
| Close structure | partial | +50% | 0 | −20% |
| Dispersed structure | no | +100% | −10% | −50% |
| Planetoid | no | 0 | +25% | special |
| Buffered planetoid | no | 0 | +50% | special |

4.1.3.1 Planetoid hulls cost Cr4000 per ton of rock. Only 80% of a planetoid, or 65% of a buffered planetoid, is usable; the tonnage budget of 4.14 is the usable part, while hull points come from the whole rock. They come with armour Protection 2 and 4 respectively (page 13), and cannot take the specialised or additional hull types of 4.1.4.

4.1.4 **Specialised hulls** (page 13) each change the hull cost after the configuration modifier, and their changes add together before being applied, as the worked example on page 14 does:

- Reinforced: +50% cost, +10% hull points.
- Light: −25% cost, −10% hull points.
- Military: +25% cost, armour may go to double the maximum of 4.2.2. Only over 5,000 tons.
- Non-gravity: −50% cost, basic power of 4.4.2 is halved. At most 500,000 tons.

4.1.5 Additional hull types (double hull, hamster cage, breakaway, page 13) are **not in this version**. Open question 9.1.

4.1.6 **Hull options** (pages 14-15), each at most once, priced per ton of hull:

| Option | TL | Cost per ton of hull | Tons |
|---|---|---|---|
| Heat shielding | 6 | MCr0.1 | 0 |
| Radiation shielding | 7 | Cr25000 | 0 |
| Reflec | 10 | MCr0.1 | 0 |
| Stealth, basic | 8 | MCr0.04 | 2% of hull |
| Stealth, improved | 10 | MCr0.1 | 0 |
| Stealth, enhanced | 12 | MCr0.5 | 0 |
| Stealth, advanced | 14 | MCr1 | 0 |

Reflec and stealth exclude each other. Solar coating (page 44) is not in this version.

### 4.2 Install armour (pages 13-14)

4.2.1 Armour costs a fraction of hull tonnage per point of Protection, at a price per ton of armour:

| Armour | TL | Tons per point | Cost per ton | Maximum protection |
|---|---|---|---|---|
| Titanium steel | 7 | 2.5% | Cr50000 | TL or 9, whichever is less |
| Crystaliron | 10 | 1.25% | Cr200000 | TL or 13, whichever is less |
| Bonded superdense | 14 | 0.8% | Cr500000 | TL |
| Molecular bonded | 16 | 0.5% | MCr1.5 | TL + 4 |

4.2.2 The maximum is read at the design TL, doubled by a military hull. Planetoid base protection counts towards it.

4.2.3 Armour tonnage is hull tons × tons per point × protection, then × (1 + armour volume modifier of 4.1.3), then × the small-hull multiplier: ×4 at 5-15 tons, ×3 at 16-25, ×2 at 26-99, ×1 from 100. The result is not rounded.

### 4.3 Install drives (pages 16-17)

4.3.1 A **manoeuvre drive** takes a percentage of the hull by thrust and costs MCr2 per ton:

| Thrust | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| % of hull | 0.5 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
| TL | 9 | 9 | 10 | 10 | 11 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |

4.3.2 A **reaction drive** costs MCr0.2 per ton and needs no power but burns fuel (4.5.3):

| Thrust | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| % of hull | 1 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32 |
| TL | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 9 | 9 | 9 | 10 | 10 | 10 | 11 | 11 | 11 | 12 |

4.3.3 A **jump drive** takes a percentage of the hull plus 5 tons, is at least 10 tons, and costs MCr1.5 per ton:

| Jump | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| % of hull | 2.5 | 5 | 7.5 | 10 | 12.5 | 15 | 17.5 | 20 | 22.5 |
| TL | 9 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |

4.3.4 A ship may have a manoeuvre drive, a reaction drive, both or neither.

4.3.5 A drive is sized against the hull unless the design says otherwise. A ship that carries drop tanks or external cargo has to recalculate its Thrust against the combined tonnage (page 49), so its drives are built to move the larger figure, and the design says which. Two of the book's ships do this: the Close Escort on page 182 carries "Thrust 5 (420 tons)" in a 400-ton hull, and the Laboratory Ship on page 186 carries "Thrust 2 (400t)" in a 360-ton one.

### 4.4 Install power plant (page 18)

4.4.1 The plant's size in tons is the designer's choice. Power is tons × power per ton:

| Plant | TL | Power per ton | Cost per ton | Can jump |
|---|---|---|---|---|
| Fission | 6 | 8 | MCr0.4 | no |
| Chemical | 7 | 5 | MCr0.25 | no |
| Fusion | 8 | 10 | MCr0.5 | yes |
| Fusion | 12 | 15 | MCr1 | yes |
| Fusion | 15 | 20 | MCr2 | yes |
| Antimatter | 20 | 100 | MCr10 | yes |

4.4.2 **Requirements.** Basic ship systems need 20% of hull tons, or 10% for a non-gravity hull. The manoeuvre drive needs 10% of hull tons × thrust, or 2.5% at thrust 0. The jump drive needs 10% of hull tons × jump rating, and only when jumping. Sensors, weapons, low berths and some systems add their own, each named in its clause.

4.4.3 The sheet lists every requirement and the power available (5.4). Whether they fit is a problem, not a hard stop (6.3).

### 4.5 Install fuel tanks (page 19)

4.5.1 Fuel costs nothing and takes tons.

4.5.2 Jump fuel is 10% of hull tons × jump rating.

4.5.2.1 The tankage may be sized for a shorter jump than the drive can make, and the design says which. That is how a drop-tank ship is built: the Close Escort has a jump-5 drive and prints "Jump-3, plus 8 weeks of operation", because its longer jumps are made on tanks it throws away. Tanking for more than the drive can use is an error.

4.5.3 Reaction drive fuel is 2.5% of hull tons per thrust per hour of operation; a thrust 0 reaction drive burns 0.25 tons per hour.

4.5.4 Power plant fuel is 10% of the plant's tons per month, rounded up to a whole ton, minimum 1, times the months the design asks for; a month is four weeks. A chemical plant instead needs 10 tons per ton of plant per two weeks.

4.5.4.1 The fixtures fix the rounding: the Scout's 4-ton plant for 12 weeks is 3 tons, not 1.2, so the round-up is per month, not on the total.

4.5.5 Extra tankage may be added on top.

### 4.6 Install bridge (page 20)

4.6.1 Bridge size by hull tons: 3 tons to 50, 6 to 99, 10 to 200, 20 to 1,000, 40 to 2,000, 60 to 100,000, then +20 tons for every further 100,000 or part. Cost MCr0.5 per 100 tons of hull or part.

4.6.2 A **smaller bridge** is one size down the table at half the cost, and is noted on the sheet as DM−1 to ship operations.

4.6.3 A **command bridge** adds 40 tons and MCr30, only over 5,000 tons.

4.6.4 A **cockpit** replaces the bridge on a ship of 50 tons or less: 1.5 tons and Cr10000, or 2.5 tons and Cr15000 for a dual cockpit. A cockpit gives no free airlock (4.14.2).

4.6.5 **Holographic controls** (page 52-53) add 25% to the bridge's cost at TL9.

### 4.7 Install computer (page 21) and software (pages 74-76, Core page 161)

4.7.1 Computers take no tons.

| Computer | TL | Cost | | Core | TL | Cost |
|---|---|---|---|---|---|---|
| /5 | 7 | Cr30000 | | Core/40 | 9 | MCr45 |
| /10 | 9 | Cr160000 | | Core/50 | 10 | MCr60 |
| /15 | 11 | MCr2 | | Core/60 | 11 | MCr75 |
| /20 | 12 | MCr5 | | Core/70 | 12 | MCr80 |
| /25 | 13 | MCr10 | | Core/80 | 13 | MCr95 |
| /30 | 14 | MCr20 | | Core/90 | 14 | MCr120 |
| /35 | 15 | MCr30 | | Core/100 | 15 | MCr130 |

4.7.2 `/bis` adds +5 processing for Jump Control only and +50% cost. `/fib` hardens against ion weapons for +50%. Both together, +100%.

4.7.3 A core's processing is in addition to what Jump Control needs, and Jump Control is included in its price.

4.7.4 **Software.** High Guard defers the basic packages to Core page 161, and the fixtures need them, so they are transcribed here: Manoeuvre (TL8) and Intellect (TL11) are included at no cost and no bandwidth; Library likewise, as every fixture sheet shows it at no cost; Jump Control/n is TL 9, 11, 12, 13, 14, 15 for n = 1 to 6, bandwidth 5n, cost MCr0.1n. Evade, Fire Control and Auto-Repair are transcribed from the same table for later use. The High Guard packages (Advanced Fire Control, Anti-Hijack, Battle Network, Battle System, Broad Spectrum EW, Conscious Intelligence, Electronic Warfare, Launch Solution, Point Defence, Screen Optimiser, Virtual Crew, Virtual Gunner) are transcribed from pages 74-76.

4.7.5 Jump Control is weighed on its own, against the processing the computer offers it: base processing plus `/bis`, or included outright in a core. Over that is an error. This is the whole point of `/bis`, and the Scout is the case: a Computer/5bis runs Jump Control/2, which wants 10 bandwidth against a base of 5.

4.7.5.1 Every other package is weighed together against base processing, and going over is only a warning, because a ship does not jump and fight at once and the book says to size the computer on what runs concurrently (page 74).

### 4.8 Install sensors (page 22)

| Grade | TL | DM | Power | Tons | Cost |
|---|---|---|---|---|---|
| Basic | 8 | −4 | 0 | 0 | 0 |
| Civilian | 9 | −2 | 1 | 1 | MCr3 |
| Military | 10 | 0 | 2 | 2 | MCr4.1 |
| Improved | 12 | +1 | 4 | 3 | MCr4.3 |
| Advanced | 15 | +2 | 6 | 5 | MCr5.3 |

### 4.9 Install weapons (pages 27-29)

4.9.1 One **hardpoint** per full 100 tons of hull. Under 100 tons a ship has **firmpoints** instead: one under 35 tons, two to 69, three to 99. A firmpoint holds one weapon, and only one firmpoint may be upgraded to a single turret.

4.9.2 Mounts, each using one hardpoint:

| Mount | TL | Power | Tons | Cost | Weapons |
|---|---|---|---|---|---|
| Fixed mount | — | 0 | 0 | MCr0.1 | up to 3 |
| Single turret | 7 | 1 | 1 | MCr0.2 | 1 |
| Double turret | 8 | 1 | 1 | MCr0.5 | 2 |
| Triple turret | 9 | 1 | 1 | MCr1 | 3 |
| Pop-up mounting | 10 | +0 | +1 | +MCr1 | applied to any of the above |

4.9.3 Turret weapons (page 29) each add power and cost to the mount and no tons:

| Weapon | TL | Range | Power | Damage | Cost | Traits |
|---|---|---|---|---|---|---|
| Beam laser | 10 | Medium | 4 | 1D | MCr0.5 | |
| Fusion gun | 14 | Medium | 12 | 4D | MCr2 | Radiation |
| Laser drill | 8 | Adjacent | 4 | 2D | Cr150000 | AP 4 |
| Missile rack | 7 | Special | 0 | 4D | MCr0.75 | Smart |
| Particle beam | 12 | Very long | 8 | 3D | MCr4 | Radiation |
| Plasma gun | 11 | Medium | 6 | 3D | MCr2.5 | |
| Pulse laser | 9 | Long | 4 | 2D | MCr1 | |
| Railgun | 10 | Short | 2 | 2D | MCr1 | AP 4 |
| Sandcaster | 9 | Special | 0 | Special | MCr0.25 | |

4.9.4 **Barbettes** (page 31) are heavy turrets. Each takes one hardpoint and 5 tons, or three firmpoints on a ship under 100 tons, where a missile or torpedo barbette takes 2 tons more. Their damage is multiplied by 3.

4.9.4.1 **Bays** (pages 32-34) come small, medium and large. The size fixes the tonnage, hardpoints, crew and damage multiple: 50 tons and one hardpoint, 100 and one, 500 and five. The weapon fixes the cost, power and damage, and each of the eleven bay weapons is priced separately at each size. A ship under 100 tons has no hardpoint to put one on.

4.9.5 **Ordnance** is bought by the load. Twelve missiles to a ton, three torpedoes, twenty canisters, and the book's prices are per bundle. Every launcher comes with a magazine that costs nothing, so what a design buys here is the stock on top of that.

4.9.6 **Spinal mounts** (pages 35-37) are sized in multiples of a base size, and the multiple scales tonnage, power, damage and cost together. They take a hardpoint per 100 tons, rounded up, and cannot exceed half the ship. Building one above its own Tech Level shrinks it and raises its price, by 10, 15 or 20 per cent against 10, 20 or 30, and the table stops at three levels.

4.9.7 **Screens** (page 42) are the meson screen and the nuclear damper, 10 tons each. They are not on the Hardpoints table, so they take none, but they do want a gunner. A **black globe generator** takes 50 tons and is not for sale at any price the rules set; its capacitors come free from a jump drive at a fifth of the drive's tonnage, and more can be bought.

4.9.8 **Point defence batteries** (page 41), laser or gauss, take 20 tons and one hardpoint each.

### 4.10 Determine crew (pages 23-24)

4.10.1 A small craft (2.2) has one pilot and nothing else.

4.10.2 Otherwise the Crew Requirements table applies, commercial or military by the design's flag:

| Role | Salary | Commercial | Military |
|---|---|---|---|
| Captain | Cr10000 | the leading officer, not extra | 1 |
| Pilot | Cr6000 | 1, +1 per small craft carried | 3, +1 per small craft carried |
| Astrogator | Cr5000 | 1 if jump drive | 1 if jump drive |
| Engineer | Cr4000 | 1 per 35 tons of drives and plant | same |
| Maintenance | Cr1000 | 1 per 1,000 tons | 1 per 500 tons |
| Gunner | Cr2000 | 1 per armed turret | 2 per armed turret |
| Steward | Cr2000 | 1 per 10 high or 100 middle passengers | same |
| Administrator | Cr1500 | 1 per 2,000 tons | 1 per 1,000 tons |
| Sensor operator | Cr4000 | 1 per 7,500 tons | 3 per 7,500 tons |
| Medic | Cr4000 | 1 per 120 crew and passengers | 1 per 120 crew |
| Officer | Cr5000 | 1 per full 20 crew | 1 per full 10 crew |

4.10.2.1 "1 per 1,000 tons", "per 120" and "per full 20" round down. **Engineers do not.** Read literally, "1 per 35 tons of drives and power plant" rounds up, and the book's own ships say otherwise. The figure is rounded to the nearest whole engineer, with one as the floor for any ship with an engine room:

| Ship | Page | Drives and plant | Engineers |
|---|---|---|---|
| Scout/Courier | 161 | 16 | 1 |
| Free Trader | 172 | 17 | 1 |
| Far Trader | 170 | 22 | 1 |
| Patrol Corvette | 188 | 71 | 2 |
| Close Escort | 182 | 128.75 | 4 |
| Destroyer Escort | 208 | 229 | 7 |

Rounding up gives the Corvette three where the book gives two. Rounding down gives the Destroyer Escort six where the book gives seven, and leaves the Scout with none. Only rounding to nearest, with a floor of one, fits all six.

4.10.2.1.1 A carried craft contributes its own drives and power plant, not its displacement. The Corvette carries a 30-ton ship's boat and is crewed as though only its own 71 tons of machinery existed. A design that does not say what a carried craft's engine room weighs contributes nothing for it.

4.10.2.3 Gunners: one per turret, barbette and screen for a commercial ship, two for a military one. Bays and spinal mounts are crewed at military rates whoever owns the ship, because the book says they require military crewing, and the sheet notes it on a civilian design. A small bay wants one gunner, a medium two, a large four, and a spinal mount one per 100 tons.

4.10.2.2 An empty turret has no gunner. The Scout carries an empty double turret and lists none.

4.10.3 Over 5,000 tons the engineer, maintenance, gunner, administrator and sensor operator counts are multiplied by 0.75 (to 19,999), 0.67 (to 49,999), 0.5 (to 99,999) or 0.33 (from 100,000), rounded up, before officers and medics are worked out.

### 4.11 Install optional systems (pages 44-64)

4.11.1 Each system is a data entry with tons, cost, power and TL, or a small rule where the book gives one. This version carries only the systems the fixtures and the next few standard ships need:

| System | Page | Tons | Cost | Power |
|---|---|---|---|---|
| Fuel processor | 50 | as chosen; 20 tons of fuel per day per ton | Cr50000 per ton | 1 per ton |
| Fuel scoops | 50 | 0 | free if streamlined, else MCr1 | |
| Docking space | 62 | 110% of the craft, rounded up | MCr0.25 per ton | |
| Full hangar | 62 | 200% of the craft, rounded up | MCr0.2 per ton | |
| Cargo crane | 53 | 2.5 + 0.5 per 150 tons of cargo or part | MCr1 per ton | |
| Cargo scoop | 53 | 2 | MCr0.5 | |
| Cargo net | 53 | 5 | MCr1 | |
| Sensor station | 53 | 1 | MCr0.5 | | 
| Probe drones, 5 | 55 | 1 | MCr0.5 | |
| Advanced probe drones, 5 | 55 | 1 | MCr0.8 | |
| Mining drones, 5 | 55 | 10 | MCr1 | |
| Repair drones | 55 | 1% of hull, minimum 1 | MCr0.2 per ton | |
| Additional airlock | 59 | as chosen, minimum 2 | MCr0.1 per ton | |
| Armoury | 59 | 1 | MCr0.25 | |
| Briefing room | 60 | 4 | MCr0.5 | |
| Workshop | 64 | 6 | MCr0.9 | |

4.11.1.1 A **custom** system with a name, tons, cost and power stands in for anything not yet transcribed, so a design is never blocked by the table being short.

4.11.2 The cargo crane is sized from the cargo the ship ends up with (4.14.1), which the crane itself reduces. The engine sizes the crane against cargo without it and checks once; the fixture Free Trader comes out at 3 tons either way.

4.11.3 A **carried craft or vehicle** is a line with its own name, tons and cost, and is berthed in a docking space, a full hangar, or nowhere. Its cost is what the designer says: the book prices an air/raft at MCr0.25 on its ship sheets. Small craft add to the pilot count (4.10.2); vehicles do not.

### 4.12 Install staterooms (page 25)

4.12.1 A stateroom is 4 tons and MCr0.5 and holds one person, or two under double occupancy at no cost.

4.12.2 A low berth is 0.5 tons and Cr50000, 1 power per 10 berths or part. An emergency low berth is 1 ton, MCr1, 1 power, and holds four.

4.12.3 Common areas cost MCr0.1 per ton. The book suggests a quarter of stateroom tonnage and the sheet notes when there is less (6.4).

### 4.13 Allocate cargo and finalise (page 26)

4.13.1 Cargo is whatever tonnage is left. Negative cargo is an error (6.1).

4.13.2 The **total** is the sum of every cost line. A standard design pays 90% of it; a new design pays 101%, the extra being the architect (page 9). Fuel costs nothing and ammunition is not yet priced, so the exclusion the book makes for them has nothing to bite on.

4.13.3 Maintenance is the purchase cost divided by 12,000, per month, rounded up to the credit. The Scout's MCr36.9405 gives Cr3079.

4.13.4 Construction takes one day per MCr of total cost, times 0.9 at TL12, 0.8 at 13, 0.7 at 14, 0.6 at 15, 0.5 at 16 and above.

### 4.14 Things the sequence does not ask for but the sheet reports

4.14.1 Tons used is the sum of every tons line; cargo is hull tons (or usable tons, 4.1.3.1) less that.

4.14.2 Airlocks: one per full 100 tons at no cost, none for a ship with a cockpit or under 100 tons.

4.14.3 Hardpoints used against available (4.9.1).

### 4.15 Customising ships (pages 71-73)

4.15.1 A component may be built above or below its own Tech Level. The **grade** chosen shifts the Tech Level it needs, alters its tonnage and cost, and grants a number of Advantage or Disadvantage slots:

| Grade | TL | Tonnage | Cost | Slots |
|---|---|---|---|---|
| Early Prototype | −2 | +100% | +1000% | 2 disadvantages |
| Prototype | −1 | 0 | +500% | 1 disadvantage |
| Budget | 0 | 0 | −25% | 1 disadvantage |
| Advanced | +1 | 0 | +10% | 1 advantage |
| Very Advanced | +2 | 0 | +25% | 2 advantages |
| High Technology | +3 | 0 | +50% | 3 advantages |

4.15.2 A component takes Advantages or Disadvantages, never both, and must fill its grade's slots exactly. Most traits take one slot; Increased Power, Stealth Jump, Orbital Range, Accurate, Very High Yield, Intense Focus and Long Range take two. A trait belongs to one category of component and cannot be moved to another. Size Reduction and the weapon Energy Inefficient cannot go on a turret weapon. Traits whose effect is not a number the sheet carries, such as Early Jump or Accurate, are reported as notes so the designer can see what was bought.

4.15.3 Three points of arithmetic, each easy to get wrong, and all three confirmed by the Close Escort on page 182:

- Alterations are **additive**. Two of +10% make +20%, not +21%.
- A price is reckoned on the **original size**, not the modified one (page 72). The Close Escort's manoeuvre drive is 21 tons grown to 26.25 by Increased Size, and priced as 21: `21 × MCr2 × 0.75 = MCr31.5`, exactly as printed.
- A power plant's **output** follows the original size and its **fuel** follows the size installed. The same ship has 38 tons of plant making Power 570 while occupying 47.5, and tanks fuel as 47.5 tons of plant, which is what makes its printed 130 tons of fuel come out right.

4.15.4 **Refits** (page 73) are priced against the system going in, at 1.5 times its cost for a major refit or 1.1 for a minor one, or against the system coming out when nothing replaces it, at 0.5 or 0.1. Major covers the power plant, the drives, spinal mounts and launch facilities; minor covers everything else. A refit takes a quarter or a tenth of the time the whole ship would take to build. Armour and anything integral to the hull cannot be changed at all. This is an operation on a finished ship rather than a step of the sequence, so the engine offers it as a function and the sheet does not carry it.

## 5. The sheet

5.1 The sheet lists lines in the book's order and with the book's section labels, so it can be laid beside a page of *Spacecraft of the Third Imperium* and read across: Hull, Armour, M-Drive, J-Drive, Power Plant, Fuel Tanks, Bridge, Computer, Sensors, Weapons, Craft, Systems, Staterooms, Software, Common Areas, Cargo.

5.2 Each line has a label, tons or none, cost or none, and power where the component draws any.

5.3 Totals: tons used, cargo, total cost, purchase cost, maintenance, construction days, hull points, airlocks, hardpoints.

5.4 Power: the available figure and the list of requirements of 4.4.2.

5.5 Fuel: jump, plant, reaction, extra, total.

5.6 Crew: each role with its count and monthly salary, the total crew, and the monthly wage bill.

5.7 Problems, section 6, in the order the sequence would have met them.

## 6. Problems

6.1 An **error** is a design the rules do not allow: tonnage over the hull, a jump drive on a hull under 100 tons, a component above the design TL, armour over its maximum, a military hull or command bridge on a ship too small for it, a cockpit on a ship too large, more mounts than hardpoints, a plant that cannot jump feeding a jump drive, reflec with stealth, Jump Control the computer cannot run.

6.2 A **warning** is a design that will work badly: fewer stateroom berths than crew, software over total processing, power short of basic systems plus manoeuvre drive plus everything else that runs in combat.

6.3 Power short of the jump drive on top of all that is a **note**, since the book calls running everything at once good practice rather than a requirement (page 18).

6.4 Other notes: a smaller bridge's DM−1, common areas under a quarter of stateroom tonnage, a jump drive raised to its 10-ton minimum.

6.5 The sheet is always produced, problems and all. A design is never refused.

## 7. Fixtures

7.1 Each fixture is a design in `src/fixtures/` and a test that its sheet matches the book line by line: every tons and cost figure, the totals, hull points, crew and power requirements.

7.2 **Scout/Courier, Type S** (page 161). TL12, 100 tons streamlined, crystaliron 4, thrust 2, jump 2, 4 tons of TL12 fusion for power 60 and 12 weeks of fuel, 10-ton bridge, Computer/5bis, military sensors, empty double turret, air/raft in a 4-ton docking space, 2-ton fuel processor, scoops, ten probe drones, workshop, four staterooms, Jump Control/2; 11 tons of cargo. Total MCr41.045, standard design MCr36.9405, Cr3079 a month, hull 40. Crew pilot, astrogator, engineer.

7.3 **Free Trader, Type A** (page 172). TL12, 200 tons streamlined, crystaliron 2, thrust 1, jump 1, 5 tons of TL12 fusion for power 75 and 4 weeks, 10-ton bridge, Computer/5, civilian sensors, 1-ton fuel processor, scoops, cargo crane, ten staterooms, twenty low berths, 10 tons of common area, Jump Control/1; 80 tons of cargo. Total MCr51.38, standard MCr46.242, Cr3854 a month, hull 80. Crew pilot, astrogator, engineer, steward, with six high and twenty low passengers declared.

7.3.1 Core prints the same ship with 11 tons of common area and a medic. High Guard is the authority here and the fixture follows it.

7.3.2 **The Free Trader's tonnage does not balance and the fixture does not pretend it does.** Its components come to 119 tons against a 200-ton hull, so cargo is 81; the sheet prints 80. Every cost on the sheet is right, and they total to the printed MCr51.38, so the slip is in the tonnage column alone. Core prints the same ship with 11 tons of common area and 81 tons of cargo, which comes to 201. Neither printing adds up, and they miss in opposite directions. The engine computes 81 and the test asserts 81, with the printed 80 named as the erratum it is. The Scout, by contrast, reconciles exactly: 89 tons of components, 11 of cargo, and MCr41.045 to the credit.

7.4 **Patrol Corvette, Type T** (page 188). The warship, and the proof of the weapons chapter. TL12, 400 tons streamlined, crystaliron 4, thrust 4, jump 3, 20 tons of TL12 fusion for power 300 and 4 weeks, 20-ton bridge, Computer/15, military sensors, four triple turrets, three pulse lasers each in two of them and three missile racks each in the other two, a ship's boat and a G/carrier each in its own docking space, 4-ton fuel processor, scoops, twelve staterooms, four low berths, 10 tons of common area, Jump Control/3 with Evade and Fire Control; 43 tons of cargo. Total MCr198.26, standard design MCr178.434, Cr14870 a month, hull 160. Its weapons draw the 28 power the book prints, which is the figure that proves the turret rules.

7.4.1 The book's crew list is not the Crew Requirements table's output and does not claim to be. It adds a medic and eight marines that no rule in the design sequence generates, and lists one pilot where the table asks for two, a carried small craft adding the second. The Subsidised Merchant on page 190 says outright what is going on: "the pilot also operates the launch". The sheets print a practical minimum crew. The fixture tests the table.

7.5 Next in line: Launch and Ship's Boat (cockpits, small craft crew), Far Trader (page 170), Subsidised Merchant (190), and a capital ship once Customising Ships lands, since the Close Escort and the Destroyer Escort both use drive advantages and disadvantages.

## 8. Saving

8.1 A design saves as its JSON, with a `version` field naming the spec version it was written under. Nothing from the sheet is saved.

8.2 Loading a design written under an older version applies whatever migration that version needs and says so. There are none yet.

## 9. Open questions

9.1 Additional hull types (double hull, hamster cage, breakaway) need per-section designs or spun-fraction inputs. Deferred until a standard ship needs one.

9.2 What still stands between this and a capital-ship fixture is the handful of Spacecraft Options the big ships carry and this spec has not transcribed: high-efficiency batteries, drop tank mounts, medical bays and barracks among them.

9.2.3 **The Close Escort's jump drive does not reconcile and the others do.** Its manoeuvre drive and power plant both fall out of the customising rules to the ton and the credit. Its jump drive is 55 tons, which is right, at MCr60, where 55 tons at MCr1.5 less a quarter for Budget is MCr61.875. No combination of the printed modifiers reaches 60. Left as the book has it, and not made a fixture.

9.2.1 The Ion torpedo is printed with the Smart trait where its damage is Special and the Ion missile beside it carries the Ion trait. Transcribed as printed and worth a second look.

9.2.2 The Repulsor Bay's Tech Level falls as the bay grows, 15 then 14 then 13, where every other bay weapon holds steady or rises. Transcribed as printed.

9.3 Whether to round armour tonnage. The book does not and the fixtures come out whole anyway.

9.4 Whether the architect's 1% belongs on the sheet of a new design by default. The book charges it; the sheets in the book are all standard designs and never show it.
