document.addEventListener("DOMContentLoaded", () => {
  // Get references to our HTML elements
  const startButton = document.getElementById("startButton");
  const statusDiv = document.getElementById("status");
  const transcriptDiv = document.getElementById("transcript");
  const statusIndicator = document.getElementById("status-indicator");

  // --- State Management ---
  let currentState = "IDLE";
  // Variables to store email parts during composition
  let recipient = "";
  let messageBody = "";

  // Check for browser support
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  if (!SpeechRecognition || !synth) {
    statusDiv.textContent =
      "Sorry, your browser does not support the Web Speech API.";
    startButton.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  let isListening = false;

  // --- Recognition Settings ---
  recognition.continuous = true;
  recognition.lang = "en-US";
  recognition.interimResults = true;

  // --- Text-to-Speech (TTS) Helper Function ---
  function speak(text, onEndCallback) {
    if (synth.speaking) {
      synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => (statusDiv.textContent = "Status: Speaking...");
    utterance.onend = () => {
      statusDiv.textContent = "Status: Waiting for command...";
      if (onEndCallback) onEndCallback();
    };
    synth.speak(utterance);
  }

  // --- Reset Compose State Function ---
  function resetCompose() {
    recipient = "";
    messageBody = "";
    currentState = "IDLE";
  }

  // --- Main Logic: Process the Recognized Command based on State ---
  function processCommand(command) {
    console.log(
      `Processing final command: "${command}" in state: ${currentState}`
    );

    if (currentState === "IDLE") {
      if (command === "read") {
        const response =
          "Fetching latest email... You have an email from Jane Smith. The subject is: Lunch Meeting. Would you like me to read the body?";
        speak(response);
        currentState = "AWAITING_READ_CONFIRMATION";
      } else if (command === "compose") {
        speak("Okay, who is the recipient?");
        currentState = "AWAITING_RECIPIENT";
      } else if (command === "goodbye") {
        speak("Goodbye!");
        stopListening();
      } else {
        speak(
          "I didn't recognize that command. Please say read, compose, or goodbye."
        );
      }
    }
    // --- Read Flow ---
    else if (currentState === "AWAITING_READ_CONFIRMATION") {
      if (command === "yes") {
        const emailBody =
          "Hi team, Just a reminder about the lunch meeting tomorrow at 1 PM. Please confirm your attendance. Thanks, Jane.";
        const followUp =
          "End of message. What would you like to do next? You can say read, compose, or goodbye.";
        speak(emailBody, () => speak(followUp));
        currentState = "IDLE";
      } else if (command === "no") {
        speak(
          "Okay. What would you like to do next? You can say read, compose, or goodbye."
        );
        currentState = "IDLE";
      } else {
        speak("Please say yes or no.");
      }
    }
    // --- Compose Flow ---
    else if (currentState === "AWAITING_RECIPIENT") {
      recipient = command;
      speak(`Okay, the recipient is ${recipient}. What is the message?`);
      currentState = "AWAITING_MESSAGE_BODY";
    } else if (currentState === "AWAITING_MESSAGE_BODY") {
      messageBody = command;
      const confirmation = `You are about to send an email to ${recipient}. The message is: ${messageBody}. Is this correct?`;
      speak(confirmation);
      currentState = "AWAITING_COMPOSE_CONFIRMATION";
    } else if (currentState === "AWAITING_COMPOSE_CONFIRMATION") {
      if (command === "yes") {
        speak("Okay, your message has been sent.", () => {
          const nextPrompt =
            "What would you like to do next? You can say read, compose, or goodbye.";
          speak(nextPrompt);
        });
        resetCompose(); // Reset for the next command
      } else if (command === "no") {
        speak("Okay, I have canceled this message.");
        resetCompose(); // Reset for the next command
      } else {
        speak("Please say yes or no to confirm sending the message.");
      }
    }
  }

  // --- Event Handlers for Recognition ---
  recognition.onresult = (event) => {
    let interim_transcript = "";
    let final_transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final_transcript += event.results[i][0].transcript;
      } else {
        interim_transcript += event.results[i][0].transcript;
      }
    }
    transcriptDiv.textContent = interim_transcript || final_transcript;
    transcriptDiv.style.color = final_transcript ? "#4CAF50" : "#FFFFFF";
    if (final_transcript) {
      processCommand(final_transcript.trim().toLowerCase());
    }
  };

  recognition.onstart = () => (statusDiv.textContent = "Status: Listening...");
  statusIndicator.classList.add("listening");
  recognition.onerror = (event) => {
    if (event.error !== "no-speech")
      statusDiv.textContent = `Error: ${event.error}`;
  };
  recognition.onend = () => {
    if (isListening) recognition.start();
  };

  // --- Control Functions ---
  function startListening() {
    if (!isListening) {
      recognition.start();
      isListening = true;
      startButton.textContent = "Stop Listening";
    }
  }

  function stopListening() {
    if (isListening) {
      isListening = false;
      recognition.stop();
      startButton.textContent = "Start Listening";
      statusDiv.textContent = "Session ended.";
    }
  }

  // --- Button Control ---
  startButton.onclick = () => {
    if (isListening) {
      stopListening();
    } else {
      const initialGreeting =
        "VocalMail activated. You can say: read, compose, or goodbye.";
      speak(initialGreeting);
      startListening();
    }
  };
});
