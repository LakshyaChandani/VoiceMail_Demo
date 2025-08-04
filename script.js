document.addEventListener("DOMContentLoaded", () => {
  // Get references to our HTML elements
  const startButton = document.getElementById("startButton");
  const statusDiv = document.getElementById("status");
  const transcriptDiv = document.getElementById("transcript");
  const statusIndicator = document.getElementById("status-indicator");

  // --- State Management ---
  let currentState = "IDLE";
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
  let recognitionPaused = false; // Track if recognition is paused for speaking

  // --- Recognition Settings ---
  recognition.continuous = true;
  recognition.lang = "en-US";
  recognition.interimResults = true;

  // --- Text-to-Speech (TTS) Helper Function ---
  function speak(text, onEndCallback) {
    // Stop recognition before speaking to avoid conflicts
    recognitionPaused = true;
    recognition.stop();

    // Cancel any ongoing speech
    if (synth.speaking) {
      synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity

    utterance.onstart = () => {
      statusDiv.textContent = "Status: Speaking...";
    };

    utterance.onend = () => {
      statusDiv.textContent = "Status: Waiting for command...";

      // Resume recognition after speaking is complete
      setTimeout(() => {
        if (isListening && recognitionPaused) {
          recognitionPaused = false;
          recognition.start();
        }
        if (onEndCallback) onEndCallback();
      }, 100); // Small delay to ensure speech is fully complete
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
    // Clean the command
    command = command.trim().toLowerCase();

    // Ignore very short commands that might be noise
    if (command.length < 2) return;

    console.log(`Processing command: "${command}" in state: ${currentState}`);

    if (currentState === "IDLE") {
      if (command.includes("read")) {
        const response =
          "Fetching latest email... You have an email from Jane Smith. The subject is: Lunch Meeting. Would you like me to read the body?";
        speak(response);
        currentState = "AWAITING_READ_CONFIRMATION";
      } else if (command.includes("compose")) {
        speak("Okay, who is the recipient?");
        currentState = "AWAITING_RECIPIENT";
      } else if (command.includes("goodbye") || command.includes("bye")) {
        speak("Goodbye!");
        setTimeout(stopListening, 1000);
      } else {
        speak(
          "I didn't recognize that command. Please say read, compose, or goodbye."
        );
      }
    }
    // --- Read Flow ---
    else if (currentState === "AWAITING_READ_CONFIRMATION") {
      if (command.includes("yes")) {
        const emailBody =
          "Hi team, Just a reminder about the lunch meeting tomorrow at 1 PM. Please confirm your attendance. Thanks, Jane.";
        const followUp =
          "End of message. What would you like to do next? You can say read, compose, or goodbye.";
        speak(emailBody, () => speak(followUp));
        currentState = "IDLE";
      } else if (command.includes("no")) {
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
      // Accept any reasonable input as recipient
      if (command.length > 2) {
        recipient = command;
        speak(`Okay, the recipient is ${recipient}. What is the message?`);
        currentState = "AWAITING_MESSAGE_BODY";
      } else {
        speak("I didn't catch that. Please say the recipient's name again.");
      }
    } else if (currentState === "AWAITING_MESSAGE_BODY") {
      // Accept any reasonable input as message
      if (command.length > 2) {
        messageBody = command;
        const confirmation = `You are about to send an email to ${recipient}. The message is: ${messageBody}. Is this correct?`;
        speak(confirmation);
        currentState = "AWAITING_COMPOSE_CONFIRMATION";
      } else {
        speak("I didn't catch that. Please say your message again.");
      }
    } else if (currentState === "AWAITING_COMPOSE_CONFIRMATION") {
      if (command.includes("yes")) {
        speak("Okay, your message has been sent.", () => {
          const nextPrompt =
            "What would you like to do next? You can say read, compose, or goodbye.";
          speak(nextPrompt);
        });
        resetCompose();
      } else if (command.includes("no")) {
        speak(
          "Okay, I have canceled this message. What would you like to do next?"
        );
        resetCompose();
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

    // Update transcript display
    transcriptDiv.textContent = interim_transcript || final_transcript || "-";
    transcriptDiv.style.color = final_transcript ? "#4CAF50" : "#94a3b8";

    // Process only final transcripts
    if (final_transcript && !recognitionPaused) {
      processCommand(final_transcript);
    }
  };

  recognition.onstart = () => {
    statusDiv.textContent = "Status: Listening...";
    statusIndicator.classList.add("listening");
  };

  recognition.onerror = (event) => {
    if (event.error !== "no-speech") {
      statusDiv.textContent = `Error: ${event.error}`;
    }
  };

  recognition.onend = () => {
    statusIndicator.classList.remove("listening");

    // Restart recognition if we're still listening and not paused
    if (isListening && !recognitionPaused) {
      setTimeout(() => {
        recognition.start();
      }, 100);
    }
  };

  // --- Control Functions ---
  function startListening() {
    if (!isListening) {
      isListening = true;
      recognitionPaused = false;
      startButton.textContent = "Stop Listening";

      const initialGreeting =
        "VocalMail activated. You can say: read, compose, or goodbye.";
      speak(initialGreeting, () => {
        // Start recognition after greeting
        recognition.start();
      });
    }
  }

  function stopListening() {
    if (isListening) {
      isListening = false;
      recognitionPaused = false;
      recognition.stop();
      startButton.textContent = "Start Listening";
      statusDiv.textContent = "Session ended.";
      statusIndicator.classList.remove("listening");
      resetCompose(); // Reset state when stopping
    }
  }

  // --- Button Control ---
  startButton.onclick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
});
