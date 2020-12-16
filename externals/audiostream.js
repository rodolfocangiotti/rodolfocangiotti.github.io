var addrRoot = 'https://audiostream.rodolfocangiotti.art'
var audioSampRate = 44100
var audioChans = 2

var audioCtx = undefined;
var audioQueue = [];
var audioSched = undefined;
var audioUntil = undefined;
var requestSched = undefined;
var requestInProgr = false;
var token = undefined;
var isPlaying = false;


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
  var gain = audioCtx.createGain();
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
  source.connect(gain);
  gain.connect(audioCtx.destination);
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
    stopStream();
    isPlaying = false;
  }
}
