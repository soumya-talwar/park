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
		.catch((err) => console.log("Media channel primed."));
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
				stateDisplay.textContent = "Sensor authorization rejected.";
			}
		} catch (error) {
			console.error("Sensor calibration exception:", error);
		}
	} else {
		startSensorTracking();
	}
});

async function pregenerateParkingSong() {
	console.log("Contacting Lyria generation engine...");
	stateDisplay.textContent = "Compiling real-time track audio...";
	stateDisplay.className = "footnote generating";
	try {
		const response = await fetch("/api/generate-music");
		if (!response.ok) throw new Error("API compilation stream error");
		const audioBlob = await response.blob();
		const audioUrl = URL.createObjectURL(audioBlob);
		audioPlayer.src = audioUrl;
		audioPlayer.load();
		console.log("Lyria track buffered locally.");
		if (isPipelineActive) {
			stateDisplay.textContent = "Drive monitoring active. Audio buffered.";
			stateDisplay.className = "footnote active";
		}
	} catch (error) {
		console.error("Audio stream acquisition broke:", error);
		stateDisplay.textContent = "Network error. System offline.";
	}
}

function startSensorTracking() {
	isPipelineActive = true;
	startBtn.disabled = true;
	startBtn.style.background = "rgba(255, 255, 255, 0.05)";
	startBtn.style.color = "rgba(255, 255, 255, 0.2)";
	startBtn.style.boxShadow = "none";
	startBtn.style.border = "1px solid rgba(255, 255, 255, 0.05)";
	startBtn.textContent = "MONITORING ACTIVE";
	if (stateDisplay.textContent !== "Compiling real-time track audio...") {
		stateDisplay.textContent = "Drive monitoring active.";
		stateDisplay.className = "footnote active";
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
	stateDisplay.textContent = "Ignition cut detected. Sequence executed.";
	stateDisplay.className = "footnote triggered";
	startBtn.textContent = "ARRIVED";
	audioPlayer
		.play()
		.then(() => console.log("Stream array deployed to hardware successfully."))
		.catch((err) => {
			console.error("Forced block detected:", err);
			stateDisplay.textContent =
				"Playback blocked. Tap screen to release audio.";
		});
}
