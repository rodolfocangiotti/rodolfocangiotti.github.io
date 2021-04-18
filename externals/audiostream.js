var addrRoot = 'https://audiostream.rodolfocangiotti.art'
var audioSampRate = 44100
var audioChans = 2
var winSize = 512;
var winAverage = 0.1;
var fadeTime = 0.25

var audioCtx = undefined;
var audioQueue = [];
var audioSched = undefined;
var audioUntil = undefined;
var mixer = undefined;
var splitter = undefined;
var spectrL = undefined;
var spectrR = undefined;
var requestSched = undefined;
var requestInProgr = false;
var token = undefined;
var isPlaying = false;
var mixerOn = false;


function setupAudioContext() {
  var ctxClass = window.AudioContext || window.webkitAudioContext ||
                 window.mozAudioContext || window.oAudioContext ||
                 window.msAudioContext;
  if (ctxClass) {
    audioCtx = new ctxClass();
    if (audioCtx.state == 'suspended') {
      audioCtx.resume();
    }
  } else {
    alert('Audio context not found');
  }
}

function setupMixer() {
  mixer = audioCtx.createGain();
  mixer.gain.value = 0.0;   // Ensure no audio is sent to output...
  mixer.connect(audioCtx.destination);
  // console.log(mixer);
}

function setupAnalyser() {
  spectrL = audioCtx.createAnalyser();
  spectrR = audioCtx.createAnalyser();
  spectrL.smoothingTimeConstant = winAverage;
  spectrR.smoothingTimeConstant = winAverage;
  spectrL.fftSize = winSize;
  spectrR.fftSize = winSize;
  spectrL.minDecibels = -120.0;
  spectrR.minDecibels = -120.0;
  spectrL.maxDecibels = 0.0;
  spectrR.maxDecibels = 0.0;
  splitter = audioCtx.createChannelSplitter(2);
  mixer.connect(splitter);
  splitter.connect(spectrL, 0);
  splitter.connect(spectrR, 1);
  // console.log(spectrL);
  // console.log(spectrL.minDecibels, spectrL.maxDecibels);
  // console.log(spectrR.minDecibels, spectrR.maxDecibels);
}


function decode(audio) {
  // Convert a base64 string to an array of 32 bit floats...
  var blob = window.atob(audio);
  var sampSize = Int16Array.BYTES_PER_ELEMENT;
  var vectSize = blob.length / sampSize;
  var audioVect = new Float32Array(vectSize);
  var view = new DataView(new ArrayBuffer(sampSize));

  for (var i = 0; i < vectSize; i++) {
    for (var j = 0; j < sampSize; j++) {
      var k = sampSize * i + j;
      view.setUint8(j, blob.charCodeAt(k));
    }
    var intVal = view.getInt16(0, true);
    audioVect[i] = intVal / Math.pow(2, 15);
  }
  return audioVect;
}


function requestToken() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", addrRoot + "/audiostream?operation=1", async = true);
  xhr.onload = function() {
    if (xhr.status == 200) {
      var jdata = JSON.parse(xhr.response);
      token = jdata['token'];
    } else {
      console.error('No token received');
    }
  }
  xhr.send();
}


function requestAudio() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", addrRoot + "/audiostream?operation=2&token=" + token, async = true);
  xhr.onload = function() {
    if (xhr.status == 200) {
      // console.log(xhr.response);
      var jdata = JSON.parse(xhr.response);
      var rawAudio = jdata['audio'];
      var audioVect = decode(rawAudio);
      audioQueue.push(audioVect);
      // console.log('requestAudio() >> response received. Queue length:', audioQueue.length);
    } else {
      console.error('No audio received');
    }
    requestInProgr = false;
  }
  xhr.timeout = 5000; // TODO
  xhr.ontimeout = function() {
    console.log('requestAudio() timed out');
    requestInProgr = false;
  }
  xhr.send();
}

function requestAudioWrapper() {
  // console.log('requestAudioWrapper() >> audio queue length:', audioQueue.length);
  var queueLen = 0
  if (audioQueue.length != undefined) {
    queueLen = audioQueue.length;
  }
  if ((token) &&
      (queueLen < 4) &&
      (!(requestInProgr))) {
    // console.log('Launching audio request. Queue length:', queueLen);
    requestInProgr = true
    requestAudio();
  }
}


function fillBuffer() {
  var audioVect = audioQueue.shift();
  var buffLen = audioVect.length / 2;
  var buff = audioCtx.createBuffer(audioChans, buffLen, audioSampRate);
  var buffLChan = buff.getChannelData(0);
  var buffRChan = buff.getChannelData(1);
  for (var i = 0; i < buffLen; i++) {
    buffLChan[i] = audioVect[i * 2];
    buffRChan[i] = audioVect[i * 2 + 1];
  }
  var source = audioCtx.createBufferSource();
  // var gain = audioCtx.createGain();
  var startTime = undefined;
  var stopTime = undefined;
  if (audioUntil == undefined) {
    startTime = audioCtx.currentTime;
    stopTime = audioCtx.currentTime + buff.duration;
  } else {
    startTime = audioUntil;
    stopTime = audioUntil + buff.duration;
  }
  source.buffer = buff;
  source.connect(mixer);
  // gain.connect(audioCtx.destination);
  source.start(startTime);
  source.stop(stopTime);
  if (audioUntil == undefined) {
    audioUntil = audioCtx.currentTime + buff.duration;
  } else {
    if (audioUntil > audioCtx.currentTime) {
      audioUntil += buff.duration;
    } else {
      // console.log('Resetting audioUntil history');
      audioUntil = audioCtx.currentTime + buff.duration;
    }
  }
  // console.log('currentTime:', audioCtx.currentTime, 'audioUntil:', audioUntil);
}

function fillBufferWrapper() {
  // console.log('fillBufferWrapper() >> audio queue length:', audioQueue.length);
  // console.log('fillBufferWrapper() >> token:', token);
  if ((token) &&
      ((audioQueue.length || 0) > 0) &&
      ((audioUntil || 0.0) - audioCtx.currentTime < 0.5)) { // TODO
    // console.log('fillBufferWrapper() >> Filling next buffer block. Audio queue length:', audioQueue.length);
    fillBuffer();
    if (!(mixerOn)) {
      mixerOn = true;
      mixer.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + fadeTime);
    }
  }
}


function startStream() {
  callSched = setInterval(requestAudioWrapper, 125);
  audioSched = setInterval(fillBufferWrapper, 125);
}

function play() {
  if (!(isPlaying)) {
    if (!(audioCtx)) {
      setupAudioContext();
      setupMixer();
      setupAnalyser();
    }
    if (!(token)) {
      requestToken()
    }
    startStream();
    isPlaying = true;
  }
}

function stopStream() {
  clearInterval(callSched);
  clearInterval(audioSched);
  audioQueue = [];
  audioUntil = undefined;
}

function stop() {
  if (isPlaying) {
    if (mixerOn) {
      mixerOn = false;
      mixer.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + fadeTime);
    }
    stopStream();
    isPlaying = false;
  }
}



// **********
// Processing implementation for specturm visualization...

function OnePole(g) {
  this._g = g;
  this._y_minus_one = 0.0;
  this.process = function(x) {
    var y = x * (1.0 - this._g) + this._y_minus_one * this._g;
    this._y_minus_one = y;
    return y;
  }
}

function Average(s) {
  this._size = s;
  this._histo = [];
  this.process = function(x) {
    this._histo.push(x);
    if (this._histo.length > this._size) {
      this._histo.shift();
    }
    var s = 0.0;
    for (var i = 0; i < this._histo.length; i++) {
      s += this._histo[i];
    }
    return s / this._histo.length;
  }
}

function StereoSpectrum(chanL, chanR) {
  this.chanL = chanL;
  this.chanR = chanR;
}

function safeSqrt(x) {
  if (x > 0) {
    return Math.sqrt(x);
  } else {
    var xAbs = Math.abs(x);
    return Math.sqrt(xAbs) * -1.0;
  }
}


var container;
var p5Rows;
var p5Columns;
var halfWidth;
var halfHeight;
var halfColumns;
var columnWidth;
var columnHeight;
var fftHisto;
var prevMag;
var magAvg;
var magLP;
var chanMagAvg;
var chanMagLP;


function setup() {
  container = document.getElementById('p5-container');
  createCanvas(container.offsetWidth, windowHeight * 0.75, WEBGL);
  frameRate(15);
  background(255);
  stroke(0);
  strokeWeight(1);
  fill(255, 0);
  smooth();

  p5Rows = 16;
  p5Columns = winSize;
  halfWidth = width / 2;
  halfHeight = height / 2;
  halfColumns = p5Columns / 2;
  columnWidth = width / p5Columns;
  columnHeight = height / p5Rows;
  fftHisto = [];
  var bins = winSize / 2;
  for (var r = 0; r < p5Rows; r++) {
    var magsL = new Uint8Array(bins);
    var magsR = new Uint8Array(bins);
    for (var b = 0; b < bins; b++) {
      magsL[b] = int(random(0, 4));
      magsR[b] = int(random(0, 4));
    }
    var fft = new StereoSpectrum(magsL, magsR);
    fftHisto.push(fft);
  }
  // Keep  prevMag undefined...
  magAvg = new Average(2);
  magLP = new OnePole(0.6);
  chanMagAvg = new Average(2);
  chanMagLP = new OnePole(0.6);
}

function draw() {
  // Update FFT history...
  var bins = winSize / 2;
  var magsL = new Uint8Array(bins);
  var magsR = new Uint8Array(bins);
  if (spectrL && spectrR) {
    console.assert(spectrL.frequencyBinCount == bins);
    console.assert(spectrR.frequencyBinCount == bins);
    spectrL.getByteFrequencyData(magsL);  // Alternative of getFloatFrequencyData()...
    spectrR.getByteFrequencyData(magsR);
    for (var b = 0; b < bins; b++) {
      magsL[b] = map(magsL[b], 0, 255, 0, 127);
      magsR[b] = map(magsR[b], 0, 255, 0, 127);
    }
  }
  for (var b = 0; b < bins; b++) {
    magsL[b] = magsL[b] > 0 ? magsL[b] : int(random(0, 4));
    magsR[b] = magsR[b] > 0 ? magsR[b] : int(random(0, 4));
  }

  var fft = new StereoSpectrum(magsL, magsR);
  fftHisto.push(fft);
  fftHisto.shift();
  // Calculate spectrum magnitude...
  var currLMag = 0.0;
  var currRMag = 0.0;
  for (var b = 0; b < bins; b++) {
    currLMag += magsL[b];
    currRMag += magsR[b];
  }
  var currMag = currLMag + currRMag;
  if (prevMag == undefined) {
    prevMag = currMag;
  }
  // Derive total magnitude...
  var magDiff = safeSqrt(currMag - prevMag);
  var filtMagDiff = magAvg.process(magDiff);
  filtMagDiff = magLP.process(filtMagDiff);
  // Calculate channel magnitude polarization...
  var chanDiff = safeSqrt(currRMag - currLMag);
  var filtChanDiff = chanMagAvg.process(chanDiff);
  filtChanDiff = chanMagLP.process(filtChanDiff);

  // Reset scene...
  var custWeight = min(columnWidth * 0.4, 1.0);
  custWeight = max(custWeight, 0.4);
  background(255);
  fill(255, 0);
  stroke(0);
  strokeWeight(custWeight);
  var x = 0;
  var y = 0;
  var z = 0;
  var coeff = 1.0;
  for (var r = 0; r < p5Rows - 1; r++) {
    beginShape(TRIANGLE_STRIP);
    for (var c = 0; c <= halfColumns; c++) {  // Iterate the first half of columns...
      // They represent the left audio channel...
      var normC = c / halfColumns;
      normC = max(normC, 0.000001);
      coeff = Math.pow(normC, 1.0 / 3.0) / normC; // Compute cubic root...
      x = c * coeff * columnWidth;
      for (var shift = 0; shift <= 1; shift++) {  // Set a point in the current and in the next row...
        y = (r + shift) * columnHeight;
        z = fftHisto[r + shift].chanL[c];
        vertex(x, y, z);
      }
    }
    endShape();
    beginShape(TRIANGLE_STRIP);
    for (var c = 0; c <= halfColumns; c++) {  // Iterate the columns for the right channel...
      var normC = c / halfColumns;
      normC = max(normC, 0.000001);
      coeff = Math.pow(normC, 1.0 / 3.0) / normC;
      x = c * coeff * columnWidth;
      x = width - x;
      for (var shift = 1; shift >= 0; shift--) {
        y = (r + shift) * columnHeight;
        z = fftHisto[r + shift].chanR[c];
        vertex(x, y, z);
      }
    }
    endShape();
  }

  filtMagDiff /= (height * 0.003);
  filtChanDiff /= (width * 0.002);
  camera(halfWidth + filtChanDiff, (height + filtMagDiff) * 1.33, height * 0.66,
         halfWidth + filtChanDiff, halfHeight + filtMagDiff, 0.0,
         0.0, 1.0, 0.0);

  prevMag = currMag;
}

function windowResized() {
  container = document.getElementById('p5-container');
  resizeCanvas(container.offsetWidth, windowHeight * 0.75);
  halfWidth = width / 2;
  halfHeight = height / 2;
  halfColumns = p5Columns / 2;
  columnWidth = width / p5Columns;
  columnHeight = height / p5Rows;
}
