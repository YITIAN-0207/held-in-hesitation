/*
 * sound_orbit.js — Soft Error visual engine (final version)
 * Includes reliable audio start + adaptive visual scaling
 */

let mic, fft, amplitude;
let isRunning = false;
let isPaused = false;
let gain = 9.0, gateThreshold = 0.022;
let levelSmooth = 0, advanceFrame = false;

let trailAlpha = 14, ribbonHistory = [], maxHistory = 28;
let particles = [], particleCount = 140;
let colorPhase = 0, colorSpeed = 0.002;

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById("start-btn").addEventListener("click", startAudio);
  document.getElementById("pause-btn").addEventListener("click", togglePause);
  document.getElementById("save-btn").addEventListener("click", saveCard);
});

function setup(){
  const container = document.getElementById("p5-container");
  const cnv = createCanvas(container.offsetWidth, container.offsetHeight);
  cnv.parent("p5-container");
  pixelDensity(1);
  noFill();
  angleMode(RADIANS);
  background(0);

  for (let i=0;i<particleCount;i++){
    particles.push({
      a: random(TWO_PI),
      r: random(160, 420),
      sp: random(0.001, 0.008),
      off: random(1000),
      size: random(3, 8),
      orbitTilt: random(PI)
    });
  }
}

function windowResized(){
  const container = document.getElementById("p5-container");
  resizeCanvas(container.offsetWidth, container.offsetHeight);
  background(0);
}

/* ---- Controls ---- */
function startAudio(){
  if (isRunning) return;
  userStartAudio().then(()=>{
    mic = new p5.AudioIn();
    mic.start(()=>{
      fft = new p5.FFT(0.9, 1024);
      fft.setInput(mic);
      amplitude = new p5.Amplitude();
      amplitude.setInput(mic);
      isRunning = true;
      loop();
      console.log("🎧 Microphone started.");
    }, err=>{
      console.error("🚫 Microphone error:", err);
      alert("Microphone permission denied or unavailable.");
    });
  });
}

function togglePause(){
  isPaused = !isPaused;
  if (isPaused) noLoop(); else loop();
}

function saveCard(){
  saveCanvas("soft_error_card_"+nf(hour(),2)+nf(minute(),2)+nf(second(),2), "jpg");
}

/* ---- Draw Loop ---- */
function draw(){
  if (!isRunning || isPaused) return;
  noStroke(); fill(0, trailAlpha); rect(0,0,width,height);

  let rawLevel = amplitude.getLevel();
  levelSmooth = lerp(levelSmooth, rawLevel, 0.4);
  advanceFrame = levelSmooth > gateThreshold;
  let L = constrain(levelSmooth * gain, 0, 2.5);

  let wave = fft.waveform(), spec = fft.analyze();
  colorPhase += colorSpeed;
  let baseGray = map(sin(colorPhase), -1, 1, 160, 255);
  let glowGray = map(sin(colorPhase + PI/2), -1, 1, 100, 255);

  let cx = width/2, cy = height/2;
  drawCoreCircle(cx, cy, 150 + L*260, baseGray, glowGray, L);
  drawWaveRibbonPolar(cx, cy, wave, baseGray, L);
  drawOrbitParticles(cx, cy, spec, glowGray, L);
  drawOuterRing(cx, cy, 260 + L*120, baseGray, L);
}

/* ---- Visual Functions ---- */
function drawCoreCircle(cx, cy, R, baseGray, glowGray, L){
  noFill();
  for (let i=0;i<6;i++){
    let rr = R*(0.3+i*0.06);
    stroke(glowGray,60+i*25+L*40);
    strokeWeight(1.5+L*1.2);
    ellipse(cx,cy,rr*2);
  }
  stroke(baseGray,220); strokeWeight(1.8); ellipse(cx,cy,R*0.5);
  fill(0); noStroke(); circle(cx,cy,R*0.05);
}

function drawWaveRibbonPolar(cx, cy, wave, g, L){
  if(!wave.length)return;
  let steps=360, baseR=280+L*220, amp=(60+L*320);
  let pts=[];
  for(let i=0;i<steps;i++){
    let idx=int(map(i,0,steps-1,0,wave.length-1));
    let a=map(i,0,steps-1,0,TWO_PI);
    let r=baseR+wave[idx]*amp;
    pts.push({x:cx+cos(a)*r,y:cy+sin(a)*r});
  }
  if(advanceFrame){
    ribbonHistory.push(pts);
    if(ribbonHistory.length>maxHistory) ribbonHistory.shift();
  }
  for(let h=0;h<ribbonHistory.length;h++){
    let alpha=map(h,0,ribbonHistory.length-1,30,180);
    let arr=ribbonHistory[h];
    noFill(); stroke(g,alpha); strokeWeight(1.5+L*1.5);
    beginShape(); for(let p of arr)curveVertex(p.x,p.y); endShape(CLOSE);
  }
}

function drawOuterRing(cx, cy, r, g, L){
  stroke(g,180+L*60); strokeWeight(1.5); ellipse(cx,cy,r*2);
  stroke(g,60); strokeWeight(0.6); ellipse(cx,cy,(r+L*20)*2);
}

function drawOrbitParticles(cx, cy, spec, glowGray, L){
  let low=bandEnergy(spec,60,250)/255, high=bandEnergy(spec,3000,9000)/255;
  let speed=0.002+high*0.03+L*0.015, radiusBoost=(low*100+L*60);
  push(); translate(cx,cy);
  for(let p of particles){
    if(advanceFrame)p.a+=p.sp+speed;
    let r=p.r+radiusBoost*noise(p.off+frameCount*0.01);
    let x=cos(p.a)*r, y=sin(p.a+p.orbitTilt*0.2)*r*0.9;
    noStroke(); fill(glowGray,180); circle(x,y,p.size+L*1.4);
    stroke(glowGray,60+L*50); line(x,y,x*0.96,y*0.96);
  }
  pop();
}

/* ---- Audio Analysis ---- */
function bandEnergy(spectrum,f0,f1){
  let nyq=sampleRate()/2;
  let i0=int(map(f0,0,nyq,0,spectrum.length-1));
  let i1=int(map(f1,0,nyq,0,spectrum.length-1));
  i0=constrain(i0,0,spectrum.length-1);
  i1=constrain(i1,0,spectrum.length-1);
  let sum=0; for(let i=i0;i<=i1;i++) sum+=spectrum[i];
  return sum/max(1,i1-i0+1);
}
