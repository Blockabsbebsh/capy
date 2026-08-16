/* =======================================================================
   MATERIAL LIBRARY
   ======================================================================= */
const M = (color, opts={}) => new THREE.MeshStandardMaterial({
  color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.0, ...opts
});

const mat = {
  grass:    M(0x8ec54f, {rough:1.0}),
  grassDark:M(0x7ab244, {rough:1.0}),
  dirt:     M(0xc9a06a, {rough:1.0}),
  water:    new THREE.MeshStandardMaterial({color:0x4fb3d9, roughness:0.18, metalness:0.15, transparent:true, opacity:0.85}),
  fur:      M(0x9a6a44, {rough:0.95}),
  furDark:  M(0x7d5335, {rough:0.95}),
  furLight: M(0xb98b62, {rough:0.95}),
  snout:    M(0x6b4429, {rough:0.9}),
  nose:     M(0x3a2418, {rough:0.6}),
  eye:      M(0x231610, {rough:0.25}),
  eyeShine: new THREE.MeshBasicMaterial({color:0xffffff}),
  bunTop:   M(0xe0a44a, {rough:0.75}),
  bunBot:   M(0xd0913c, {rough:0.75}),
  patty:    M(0x633a22, {rough:0.95}),
  cheese:   M(0xffc63c, {rough:0.6}),
  lettuce:  M(0x76c043, {rough:0.85}),
  sesame:   M(0xfff0cf, {rough:0.6}),
  melonRind:M(0x2f8f3e, {rough:0.7}),
  melonSkin:M(0x1f6e2d, {rough:0.7}),
  melonFlesh:M(0xff4f68, {rough:0.55}),
  melonSeed:M(0x2a1a12, {rough:0.4}),
  chili:    M(0xd63628, {rough:0.35, metal:0.05}),
  stem:     M(0x4f8b3a, {rough:0.8}),
  soap:     M(0x9fd8ef, {rough:0.25, metal:0.05}),
  soapText: M(0xffffff, {rough:0.3}),
  bubble:   new THREE.MeshStandardMaterial({color:0xeaffff, roughness:0.05, metalness:0.1, transparent:true, opacity:0.45}),
  // power-ups
  magnetBody: M(0xe23b44, {rough:0.35, metal:0.3}),
  magnetTip:  M(0xf2f4f7, {rough:0.3, metal:0.4}),
  shieldCore: M(0x2fd8ff, {rough:0.2, emissive:0x1a7f99}),
  shieldSkin: new THREE.MeshStandardMaterial({color:0x9ff0ff, roughness:0.05, metalness:0.1, transparent:true, opacity:0.34}),
  glassCyan:  new THREE.MeshStandardMaterial({color:0xbff4ff, roughness:0.1, metalness:0.1, transparent:true, opacity:0.55, side:THREE.DoubleSide}),
  glassFrame: M(0xd6a24a, {rough:0.35, metal:0.5}),
  sand:       M(0xffd98a, {rough:0.8}),
  bubbleSkin: new THREE.MeshStandardMaterial({color:0x9ff0ff, roughness:0.05, metalness:0.2, transparent:true, opacity:0.22, side:THREE.DoubleSide}),
  // heart pickup — emissive so it glows in the dark themes too
  heart:     M(0xff3d68, {rough:0.3, emissive:0xb01030, emissiveIntensity:0.9}),
  heartGlow: new THREE.MeshBasicMaterial({color:0xff8fae, transparent:true, opacity:0.22}),
  // hats
  yuzu:     M(0xffb128, {rough:0.55}),
  straw:    M(0xe8c887, {rough:0.95}),
  hatBand:  M(0xc75b4a, {rough:0.8}),
  party:    M(0xff5da2, {rough:0.6}),
  partyDot: M(0xfff2a8, {rough:0.5}),
  gold:     M(0xffcb3d, {rough:0.25, metal:0.8}),
  gemRed:   M(0xff4a5e, {rough:0.15, metal:0.3}),
  gemBlue:  M(0x4ab5ff, {rough:0.15, metal:0.3}),
  duck:     M(0xffd94a, {rough:0.7}),
  beak:     M(0xff9a2e, {rough:0.6}),
  holeRim:  M(0x8a6a42, {rough:1.0}),
  holeDark: new THREE.MeshBasicMaterial({color:0x241a10}),
  holeDeep: new THREE.MeshBasicMaterial({color:0x0d0805}),
  missileGlow: new THREE.MeshBasicMaterial({color:0xff8a3c, transparent:true, opacity:0.5}),
  trunk:    M(0x8a5a35, {rough:1.0}),
  leafA:    M(0x4e9c3f, {rough:1.0}),
  leafB:    M(0x3f8735, {rough:1.0}),
  leafC:    M(0x62b04a, {rough:1.0}),
  rock:     M(0x9aa0a4, {rough:1.0}),
  cloud:    M(0xffffff, {rough:1.0, fog:true}),
};

