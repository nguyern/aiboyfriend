//Attributed to Karen Ann's github using serial communication activity and speech synsthesis 
//Attributed use of CHATGPT to help debug 
let pingSound;

function preload() {
  pingSound = loadSound('ping.mp3');
}

//Array of different emotions to respond to distance and sentiment
let lovingLines = [
  "You're my everything.",
  "Come closer, I miss you.",
  "I love the way you look at me.",
  "Stay with me.",
  "You're the love of my life.",
  "Please don't leave me."
];

let reactiveLines = [
  "Where did you go?",
  "Why didn’t you say anything?",
  "I’m literally trying my best, okay?",
  "Did I do something wrong?"
];

let toxicLines = [
  "Of course you'd ignore me.",
  "You're always like this.",
  "Where do you think you're going?",
  "I need you.",
  "You're exhausting to talk to."
];

//Keywords to detect user sentiment from text input
let lovingKeywords = ["love", "miss", "baby", "beautiful", "cute", "kiss", "hug", "sweet"];
let toxicKeywords = ["hate", "ugly", "leave", "annoying", "stupid", "ignore", "fuck", "die"];

//For speech timing and emotional state
let currentLineIndex = 0;
let lastSpokenTime = 0;
let speakInterval = 10000;
let lastLikeTime = 0;

//Voice and visua;/audio feedback
let boyfriendVoice;
let targetVolume = 0;
let volume = 0;
let bars = 5;

//Serial communication data
let serial;
let dataIn = 0;
let sentimentScore = 0.5;
let moodBackground = null;
let moodTimeout;

//For transitioning back from text input to distance input background
let transitioning = false;
let transitionStartTime = 0;
let transitionDuration = 1000;
let startColour;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Helvetica');
  noStroke();

//Serial connection set up - from Karen Ann's github and CHATGPT debugging
  serial = new Serial();
  serial.on(SerialEvents.DATA_RECEIVED, onSerialDataReceived);
  serial.connectAndOpen(null, { baudRate: 9600 });

  setTimeout(() => {
    let voices = speechSynthesis.getVoices();
    //Looks through and assigned specific male voice from avaliable speechSynthesis system
    boyfriendVoice = voices.find(v => v.name === "Google UK English Male") ||
                     voices.find(v => v.name.includes("Daniel") || v.name.includes("Alex") || v.name.toLowerCase().includes("male"));
    speakFromDistance();
    lastSpokenTime = millis();
    lastLikeTime = millis();
  }, 100);
}

function draw() {
  let clampedDistance = constrain(dataIn, 0, 120); //Limits distance
  let loveColour = color(255, 190, 240);
  let midColour = color(255, 140, 140);
  let toxicColour = color(120, 0, 10);
  let distantColour = color(20);
  let sensorColour;

//Sets background based on proximity
  if (clampedDistance <= 10) {
    sensorColour = loveColour;
  } else if (clampedDistance <= 30) {
    let amt = map(clampedDistance, 10, 30, 0, 1);
    sensorColour = lerpColor(loveColour, midColour, amt);
  } else if (clampedDistance <= 80) {
    let amt = map(clampedDistance, 30, 80, 0, 1);
    sensorColour = lerpColor(midColour, toxicColour, amt);
  } else {
    let amt = map(clampedDistance, 80, 120, 0, 1);
    sensorColour = lerpColor(toxicColour, distantColour, amt);
  }

//Deals with custom mood background and transitioning fade from text to distance sensor background
  if (moodBackground && !transitioning) {
    background(moodBackground);
  } else if (transitioning && startColour) {
    let elapsed = millis() - transitionStartTime;
    let amt = constrain(elapsed / transitionDuration, 0, 1);
    let fadeColour = lerpColor(startColour, sensorColour, amt);
    background(fadeColour);
    if (amt >= 1) {
      transitioning = false;
      moodBackground = null;
      startColour = null;
    }
  } else {
    background(sensorColour);
  }

//Draw volume bars
  targetVolume *= 0.9;
  volume += (targetVolume - volume) * 0.1;

  let centerX = width / 2;
  let centerY = height / 2 - 100;
  let totalWidth = 240;
  let spacing = 10;
  let barWidth = (totalWidth - (bars - 1) * spacing) / bars;
  let maxHeight = 120;

  for (let i = 0; i < bars; i++) {
    let x = centerX - totalWidth / 2 + i * (barWidth + spacing);
    let pulse = sin(frameCount * 0.1 + i * 0.8);
    let aggressionFactor = map(dataIn, 0, 100, 1, 2.5);
    let h = map(pulse * volume * aggressionFactor, -1, 1, 20, maxHeight);
    rect(x, centerY - h / 2, barWidth, h, barWidth / 2);
  }

  if (millis() - lastSpokenTime > speakInterval) {
    speakFromDistance();
    lastSpokenTime = millis();
  }

  if (millis() - lastLikeTime > 15000) {
    let interruptLine;
    if (dataIn <= 10) {
      interruptLine = "I still love you no matter what.";
    } else if (dataIn <= 30) {
      interruptLine = "Why aren’t you saying anything?";
    } else {
      interruptLine = "Are you ignoring me again?";
    }
    speakLine(interruptLine);
    lastLikeTime = millis();
  }
}

//Choose line based on sensor + sentiment score
function speakFromDistance() {
  let proximityScore = map(dataIn, 0, 120, 1, 0);
  let moodScore = (0.7 * proximityScore + 0.3 * sentimentScore); //equal weight of proximity and sentiment so they can work and/or in conjunction
  let currentLines;

  if (moodScore > 0.65) {
    currentLines = lovingLines; //if physically close and/or have recently been sentimental
  } else if (moodScore > 0.35) {
    currentLines = reactiveLines;
  } else {
    currentLines = toxicLines;
  }

  currentLineIndex = (currentLineIndex + 1) % currentLines.length;
  speakLine(currentLines[currentLineIndex]);
}

//Speak and animate line
function speakLine(line) {
  if (pingSound && pingSound.isLoaded()) {
    pingSound.play();
  }

  let msg = new SpeechSynthesisUtterance(line);
  if (boyfriendVoice) msg.voice = boyfriendVoice;
  msg.pitch = 0.9;
  msg.rate = 1;
  speechSynthesis.speak(msg);
  targetVolume = 1;

  let bubble = createDiv(line);
  bubble.class('chat-bubble ai');
  select('#chat-log')?.child(bubble);
  let chatBox = document.getElementById('chat-log');
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}

//User input from chat box
function handleUserInput() {
  const inputField = document.getElementById("user-input");
  const message = inputField.value.trim();
  if (message === "") return;

  let bubble = createDiv(message);
  bubble.class('chat-bubble user');
  select('#chat-log')?.child(bubble);
  document.getElementById('chat-log').scrollTop = document.getElementById('chat-log').scrollHeight;
  inputField.value = "";

  let lowered = message.toLowerCase();
  let score = 0.5;

  lovingKeywords.forEach(word => {
    if (lowered.includes(word)) score += 0.2;
  });
  toxicKeywords.forEach(word => {
    if (lowered.includes(word)) score -= 0.2;
  });

  setMoodFromSentiment(score);
  lastSpokenTime = millis();
  lastLikeTime = millis();
}

//Change mood based on keywords in user text
function setMoodFromSentiment(score) {
  transitioning = false;
  startColour = null;
  sentimentScore = constrain(score, 0, 1);
  let currentLines;

  if (sentimentScore >= 0.7) {
    currentLines = lovingLines;
    moodBackground = color(255, 190, 240);
  } else if (sentimentScore >= 0.3) {
    currentLines = reactiveLines;
    moodBackground = color(120, 0, 10);
  } else {
    currentLines = toxicLines;
    moodBackground = color(120, 0, 10);
  }

  currentLineIndex = (currentLineIndex + 1) % currentLines.length;
  speakLine(currentLines[currentLineIndex]);

  if (moodTimeout) clearTimeout(moodTimeout);

  moodTimeout = setTimeout(() => {
    transitioning = true;
    transitionStartTime = millis();
    startColour = moodBackground;
  }, 3000);
}

//Serial sensor input from Arduino
function onSerialDataReceived(sender, newData) {
  const cleaned = newData.trim();
  if (!isNaN(cleaned)) {
    dataIn = parseFloat(cleaned);
    //console.log("Distance:", dataIn);
  }
}

//Reconnect on mouse click if serial is dropped
function mousePressed() {
  if (!serial || !serial.isOpen()) {
    serial = new Serial();
    serial.on(SerialEvents.DATA_RECEIVED, onSerialDataReceived);
    serial.connectAndOpen(null, { baudRate: 9600 });
    console.log("Attempting to reconnect");
  }
}
