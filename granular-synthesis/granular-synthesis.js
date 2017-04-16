function Grano(durata, deltaDurata, frequenza, deltaFrequenza, armonicita, deltaArmonicita, indiceModulazione, deltaIndiceModulazione, ampiezza, deltaAmpiezza, panning, deltaPanning) {
  // Funzione costruttore di oggetti grano.

  this.durata = durata;
  this.deltaDurata = deltaDurata;
  this.frequenza = frequenza;
  this.deltaFrequenza = deltaFrequenza;
  this.armonicita = armonicita;
  this.deltaArmonicita = deltaArmonicita;
  this.indiceModulazione = indiceModulazione;
  this.deltaIndiceModulazione = deltaIndiceModulazione;
  this.ampiezza = ampiezza;
  this.deltaAmpiezza = deltaAmpiezza;
  this.panning = panning;
  this.deltaPanning = deltaPanning;

}

window.AudioContext = window.AudioContext || window.webkitAudioContext;
var contextAudio = new AudioContext();

function generoGrano(oggettoGrano) {

  // Questo blocco di variabili definisce i parametri generativi di un grano.
  var durataGrano = 0;
  var pausaGrano = 0;
  var frequenzaGrano = 0;
  var armonicitaGrano = 0;
  var indiceModulazioneGrano = 0;
  var ampiezzaGrano = 0;
  var panningGrano = 0;

  // Questo blocco di variabili definisce gli oggetti generanti un grano.
  var modulante;
  var gainModulante;
  var portante;
  var gainPortante;
  var inviluppo;
  var panner;



  function generoParametriGrano() {
    // Funzione puntante l'oggetto oggettoGrano inizialmente definito.
    // Utilizzando le proprietà puntate, calcola i parametri di generazione di un grano, precedentemente definiti.

    durataGrano = Math.trunc(Math.random() * 2 * oggettoGrano.deltaDurata - oggettoGrano.deltaDurata) + oggettoGrano.durata;
    pausaGrano = Math.trunc(Math.random() * 2 * oggettoGrano.deltaPausa - oggettoGrano.deltaPausa) + oggettoGrano.pausa;
    frequenzaGrano = Math.random() * 2 * oggettoGrano.deltaFrequenza - oggettoGrano.deltaFrequenza + oggettoGrano.frequenza;
    armonicitaGrano = Math.random() * 2 * oggettoGrano.deltaArmonicita - oggettoGrano.deltaArmonicita + oggettoGrano.armonicita;
    indiceModulazioneGrano = Math.random() * 2 * oggettoGrano.deltaIndiceModulazione - oggettoGrano.deltaIndiceModulazione + oggettoGrano.indiceModulazione;
    ampiezzaGrano = Math.random() * 2 * oggettoGrano.deltaAmpiezza - oggettoGrano.deltaAmpiezza + oggettoGrano.ampiezza;
    panningGrano = Math.random() * 2 * oggettoGrano.deltaPanning - oggettoGrano.deltaPanning + oggettoGrano.panning;

  }

  function istanzioGrano() {

    function attacco() {
      inviluppo.gain.setValueAtTime(0, contextAudio.currentTime);
      inviluppo.gain.linearRampToValueAtTime(1, contextAudio.currentTime + durataGrano * 0.25 * 0.001);
    }

    function rilascio() {
      inviluppo.gain.linearRampToValueAtTime(0, contextAudio.currentTime + durataGrano * 0.25 * 0.001);
    }



    modulante = contextAudio.createOscillator();
    gainModulante = contextAudio.createGain();
    portante = contextAudio.createOscillator();
    gainPortante = contextAudio.createGain();
    inviluppo = contextAudio.createGain();
    panner = contextAudio.createStereoPanner();

    modulante.frequency.value = frequenzaGrano * armonicitaGrano;
    modulante.connect(gainModulante);
    gainModulante.gain.value = modulante.frequency.value * indiceModulazioneGrano;
    gainModulante.connect(portante.frequency);
    portante.frequency.value = frequenzaGrano;
    portante.connect(gainPortante);
    gainPortante.gain.value = ampiezzaGrano;
    gainPortante.connect(inviluppo);
    inviluppo.connect(panner);
    panner.pan.value = panningGrano;
    panner.connect(contextAudio.destination);

    modulante.start(contextAudio.currentTime);
    portante.start(contextAudio.currentTime);



    attacco();
    setTimeout(rilascio, durataGrano * 0.75);

  }

  function spengoGrano() {

    modulante.disconnect(gainModulante);
    gainModulante.disconnect(portante.frequency);
    portante.disconnect(gainPortante);
    gainPortante.disconnect(inviluppo);
    inviluppo.disconnect(panner);
    panner.disconnect(contextAudio.destination);

    modulante.stop(contextAudio.currentTime);
    portante.stop(contextAudio.currentTime);

  }



  generoParametriGrano();
  istanzioGrano();
  setTimeout(spengoGrano, durataGrano * 1.25);

}

function scheduloGrano(t, deltaT) {

  var timeout;

  function scheduler() {

    timeout = Math.trunc(Math.random() * 2 * deltaT - deltaT) + t;

    generoGrano(flussoFondamentale);
    generoGrano(flussoQuinta);
    generoGrano(flussoOttava);

    setTimeout(scheduler, timeout);

  }

  scheduler();

}



var flussoFondamentale;
var flussoQuinta;
var flussoOttava;

flussoFondamentale =  new Grano(375, 125, 55, 0.01, 1, 0.01, 6, 0.25, 0.3, 0.1, 0, 0.25);
flussoQuinta =        new Grano(350, 100, 82.5, 0.01, 1, 0.01, 5, 0.25, 0.1, 0.05, 0.75, 0.25);
flussoOttava =        new Grano(325, 75, 110, 0.01, 1, 0.01, 4, 0.25, 0.03333, 0.025, -0.75, 0.25);

scheduloGrano(150, 50);



var xMassimo;
var yMassimo;

xMassimo = window.innerWidth;
yMassimo = window.innerHeight;

document.addEventListener("mousemove", function(evento) {

    flussoFondamentale.panning = evento.clientX / xMassimo * 1.5 - 0.75;
    flussoQuinta.panning = Math.pow(evento.clientX / xMassimo, 0.8) * 1.5 - 0.25;
    flussoOttava.panning = Math.pow(evento.clientX / xMassimo, 1,2) * 1.5 - 1.25;

    flussoFondamentale.indiceModulazione = evento.clientY / yMassimo * 6 + 2;
    flussoQuinta.indiceModulazione = Math.pow(evento.clientY / yMassimo, 0.75) * 5 + 1.5;
    flussoOttava.indiceModulazione = Math.pow(evento.clientY / yMassimo, 2) * 4 + 1;

  }
);