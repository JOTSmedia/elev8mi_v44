# Asset licences (website/assets and inline icons)

## Social / contact icons (inline SVG sprite at the end of index.html)

| Icon | Source | Licence |
|---|---|---|
| Instagram | Simple Icons v16.33.0, `icons/instagram.svg` (https://simpleicons.org) | CC0 1.0 (public domain). The Instagram mark itself is a trademark of Meta; it is used only to link to the @elev8mi profile. |
| Mail (email link) | Lucide v1.50.0, `mail.svg` (https://lucide.dev) | ISC licence, © Lucide Contributors (portions © Cole Bemis, Feather, MIT) |
| Globe (website link) | Lucide v1.50.0, `globe.svg` (https://lucide.dev) | ISC licence, © Lucide Contributors (portions © Cole Bemis, Feather, MIT) |

The paths are copied unchanged; only their colour comes from the site CSS (`currentColor`, gold).

Other asset notes: see `EARTH-IMAGERY.md`, `TAROT-ART.md`, `deck/LICENSES.md` and `../AUDIO-LICENSE.md`.

## ELEV8MI asset licences: E8-05 3D space scene (assets/space/, vendor/three*)

Only public-domain sources are used, plus ESO's CC BY 4.0 panorama (credit below) and MIT code.
Files ending `-m.webp` are the mobile tier (half resolution) of the same source.
Processing: resized, recompressed to WebP. Normal maps were derived from elevation data. Gas-giant/Venus maps were
built from latitude profiles sampled from the listed photographs (limb darkening removed).

| File(s) | Source URL | Author / credit | Licence |
|---|---|---|---|
| mercury.webp | https://commons.wikimedia.org/wiki/File:Mercury_global_map_2013-05-14_bright.png (MESSENGER global mosaic) | NASA / Johns Hopkins University APL / Carnegie Institution of Washington | Public domain (NASA) |
| mars.webp | https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg (USGS Viking MDIM 2.1 colour mosaic) | NASA / JPL / USGS | Public domain |
| jupiter.webp | https://commons.wikimedia.org/wiki/File:Jupiter_Cylindrical_Map_-_Dec_2000_PIA07782.jpg (https://photojournal.jpl.nasa.gov/catalog/PIA07782) | NASA / JPL / Space Science Institute (Cassini) | Public domain |
| saturn.webp | https://commons.wikimedia.org/wiki/File:Saturn_during_Equinox.jpg (latitude profile) | NASA / JPL / Space Science Institute (Cassini) | Public domain |
| uranus.webp | https://commons.wikimedia.org/wiki/File:Uranus2.jpg (latitude profile) | NASA / JPL-Caltech (Voyager 2) | Public domain |
| neptune.webp | https://commons.wikimedia.org/wiki/File:Neptune_Full.jpg (latitude profile) | NASA / JPL (Voyager 2) | Public domain |
| venus.webp | https://commons.wikimedia.org/wiki/File:PIA23791-Venus-NewlyProcessedView-20200608.jpg (https://photojournal.jpl.nasa.gov/catalog/PIA23791, Mariner 10; latitude profile) | NASA / JPL-Caltech | Public domain (NASA) |
| saturn-rings.png | No image source. Generated radial profile using ring radii from the NASA Saturnian Rings Fact Sheet (https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html) | ELEV8MI build (tools/build_rings.py) | n/a (generated data) |
| moon.webp | https://svs.gsfc.nasa.gov/4720 (CGI Moon Kit, lroc_color_poles_2k.tif) | NASA Scientific Visualization Studio; LRO LROC (NASA/GSFC/Arizona State University) | Public domain (NASA) |
| moon-normal.webp | https://svs.gsfc.nasa.gov/4720 (CGI Moon Kit, ldem_3_8bit.jpg, LOLA elevation) → normal map | NASA SVS; LRO LOLA team | Public domain (NASA) |
| earth-detail.webp (RG: relief normal, B: ocean mask) | https://visibleearth.nasa.gov/images/73934/topography (gebco_08_rev_elev_5400x2700.jpg) and https://visibleearth.nasa.gov/images/73963/bathymetry (gebco_08_rev_bath_5400x2700.jpg) | NASA Earth Observatory / Reto Stöckli; GEBCO data | Public domain (NASA Visible Earth) |
| earth-night.webp | https://earthobservatory.nasa.gov/features/NightLights (BlackMarble_2016_3km.jpg, https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg) | NASA Earth Observatory / Joshua Stevens; Suomi NPP VIIRS (Miguel Román, NASA GSFC) | Public domain (NASA) |
| earth-surfacemap-m.webp, earth-cloudmap-m.webp | Mobile copies of the existing v31 Blue Marble maps (see assets/EARTH-IMAGERY.md) | NASA GSFC / Reto Stöckli, Robert Simmon | Public domain (NASA) |
| milkyway.webp | https://www.eso.org/public/images/eso0932a/ (https://cdn.eso.org/images/large/eso0932a.jpg) | **ESO/S. Brunier** | **CC BY 4.0**: credit "ESO/S. Brunier" must stay with the site |
| vendor/three.module.min.js (r169) | https://registry.npmjs.org/three/-/three-0.169.0.tgz (https://github.com/mrdoob/three.js) | three.js authors | MIT (vendor/three.LICENSE.txt) |

Required attribution text (CC BY 4.0) for the site credits/README: "Milky Way panorama: ESO/S. Brunier (CC BY 4.0)."

The CC BY 4.0 credit is displayed on the site as a footer line ("Milky Way panorama: ESO/S. Brunier (CC BY 4.0)") linking to https://www.eso.org/public/images/eso0932a/ (added in v31).

saturn.webp / saturn-m.webp: in v31 the master applied a light vertical blur to the rows just north of the equator, to soften a thin ring-shadow seam from the source photo.

## Night sky data (v33, E8-12)

| File | Source | Credit | Licence |
|---|---|---|---|
| assets/sky/night-sky.json: star positions and magnitudes (RA/Dec J2000, V mag, B-V, HIP number), filtered to mag 5.0 and the hero sky window | Hipparcos catalogue (ESA, public domain facts) as packaged in d3-celestial `data/stars.6.json`, https://github.com/ofrohn/d3-celestial | ESA Hipparcos; d3-celestial by Olaf Frohn | BSD-3-Clause (assets/sky/d3-celestial-LICENSE.txt) |
| assets/sky/night-sky.json: constellation stick figures (Ursa Major, Ursa Minor, Orion, Cassiopeia, Cepheus, Draco, Taurus, Gemini, Auriga, Perseus, Canis Major, Canis Minor, Leo, Lynx, Cancer, Boötes) | d3-celestial `data/constellations.lines.json` | Olaf Frohn | BSD-3-Clause (assets/sky/d3-celestial-LICENSE.txt) |

No Stellarium or GPL data is used. Day clouds are procedural (shader noise); no cloud image was added.
The Milky Way is still the ESO/S. Brunier panorama above (CC BY 4.0, credit in the footer), now sampled through the same sky projection as the stars.

## Constellation and star cards (v34, E8-13)

| Item | Source | Author | Licence |
|---|---|---|---|
| constellations-info.json: short descriptions, myths, seasons, magnitudes, distances and spectral types for 16 constellations and 21 named stars | Written for ELEV8MI from well-established public astronomy facts (IAU constellation names, Hipparcos magnitudes, standard catalogue spectral types and distances; uncertain values are stated as ranges or omitted) and classical mythology | ELEV8MI | Original text, part of the site |
| Constellation glow lines and star targets | Drawn at runtime from assets/sky/night-sky.json (see "Night sky data" above) | Olaf Frohn (d3-celestial), ESA Hipparcos | BSD-3-Clause (assets/sky/d3-celestial-LICENSE.txt) |
