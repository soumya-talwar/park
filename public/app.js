const startBtn = document.getElementById("start-btn");
const varianceDisplay = document.getElementById("variance-display");
const stateDisplay = document.getElementById("state-display");
const audioPlayer = document.getElementById("parking-song");

const VARIANCE_THRESHOLD = 0.001;
const WINDOW_SIZE = 100;
const REQUIRED_STEADY_FRAMES = 50;

let magnitudeHistory = [];
let isPipelineActive = false;
let songHasPlayed = false;
let lowVarianceFrameCount = 0;

startBtn.addEventListener("click", async () => {
	audioPlayer
		.play()
		.then(() => {
			audioPlayer.pause();
			audioPlayer.currentTime = 0;
		})
		.catch((err) => console.log("Audio thread prepped."));
	pregenerateParkingSong();

	if (
		typeof DeviceMotionEvent !== "undefined" &&
		typeof DeviceMotionEvent.requestPermission === "function"
	) {
		try {
			const permissionState = await DeviceMotionEvent.requestPermission();
			if (permissionState === "granted") {
				startSensorTracking();
			} else {
				alert("Permission to access device motion data was denied.");
			}
		} catch (error) {
			console.error("Error requesting sensor clearance:", error);
		}
	} else {
		startSensorTracking();
	}
});

async function pregenerateParkingSong() {
	console.log("Contacting local backend api logic...");
	stateDisplay.textContent = "Status: Generating AI Hype Track...";
	stateDisplay.className = "state-badge generating";
	try {
		const response = await fetch("/api/generate-music");
		if (!response.ok)
			throw new Error("Backend server down or error fetching stream");
		const audioBlob = await response.blob();
		const audioUrl = URL.createObjectURL(audioBlob);
		audioPlayer.src = audioUrl;
		audioPlayer.load();
		console.log("Lyria track buffered successfully.");
		if (isPipelineActive) {
			stateDisplay.textContent = "Status: Monitoring Drive (Track Ready)";
			stateDisplay.className = "state-badge active";
		}
	} catch (error) {
		console.error("Music generation pipeline failure:", error);
		stateDisplay.textContent = "Status: Generation Failed (Using Fallback)";
		audioPlayer.src =
			"https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";
		audioPlayer.load();
	}
}

function startSensorTracking() {
	isPipelineActive = true;
	startBtn.style.display = "none";
	if (stateDisplay.textContent !== "Status: Generating AI Hype Track...") {
		stateDisplay.textContent = "Status: Monitoring Drive";
		stateDisplay.className = "state-badge active";
	}
	window.addEventListener("devicemotion", (event) => {
		if (songHasPlayed || !isPipelineActive) return;
		const acc = event.accelerationIncludingGravity;
		if (!acc || acc.x === null) return;
		const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
		magnitudeHistory.push(magnitude);
		if (magnitudeHistory.length > WINDOW_SIZE) magnitudeHistory.shift();
		if (magnitudeHistory.length === WINDOW_SIZE) {
			const currentVariance = calculateVariance(magnitudeHistory);
			varianceDisplay.textContent = currentVariance.toFixed(5);
			if (currentVariance < VARIANCE_THRESHOLD) {
				lowVarianceFrameCount++;
				if (lowVarianceFrameCount >= REQUIRED_STEADY_FRAMES) {
					triggerParkingSequence();
				}
			} else {
				lowVarianceFrameCount = 0;
			}
		}
	});
}

function calculateVariance(array) {
	const mean = array.reduce((sum, val) => sum + val, 0) / array.length;
	return (
		array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / array.length
	);
}

function triggerParkingSequence() {
	songHasPlayed = true;
	isPipelineActive = false;
	stateDisplay.textContent = "Status: Engine Off / Parked";
	stateDisplay.className = "state-badge triggered";
	varianceDisplay.style.color = "#f85149";
	audioPlayer
		.play()
		.then(() => console.log("Song playing on CarPlay line."))
		.catch((err) => {
			console.error("Playback block:", err);
			stateDisplay.textContent = "Status: Click to Play Music";
		});
}
