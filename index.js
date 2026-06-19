const express = require("express");
const fs = require("fs");
const https = require("https");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const app = express();
const PORT = 3000;
const KEY_PATH = path.join(__dirname, "lyria.json");

if (!fs.existsSync(KEY_PATH)) {
	console.error("Error: lyria.json missing from root directory!");
	process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/generate-music", async (req, res) => {
	console.log("Auth pipeline triggered. Fetching token...");
	try {
		const auth = new GoogleAuth({
			keyFile: KEY_PATH,
			scopes: "https://www.googleapis.com/auth/generative-language",
		});
		const client = await auth.getClient();
		const tokenResponse = await client.getAccessToken();
		const ACCESS_TOKEN = tokenResponse.token;
		const payload = JSON.stringify({
			contents: [
				{
					parts: [
						{
							text: `A professional-grade, hyper-energetic, fast-paced modern Punjabi Pop and Bhangra track at 130 BPM, with a total duration of 30 seconds. 

          Track Architecture & Audio Engineering Rules:
          - ABSOLUTELY ZERO INTRO: The male vocals must explode instantly on the very first frame of the audio stream. 
          - Rhythmic Structure: Maintain a relentless, hard-hitting live Dhol and Dholak rhythmic loop with sharp, snapping claps on the backbeat.
          - Lead Instrument: A traditional, bright, repeating Tumbi melody must act as the high-energy main hook behind the vocals. 
          - Lower End: A heavy, clean, pumping modern synthetic 808 sub-bass to anchor the groove.
          - The song must have a definitive, intentional musical resolution at the 29-second mark so it ends on a punchy final beat rather than fading or cutting off.

          Vocal & Linguistic Specifications:
          - Vocal Profile: A powerful, high-pitched, open-throated native Punjabi male pop singer. The delivery must sound like a major urban Punjabi music release (high-energy, melodic but aggressively rhythmic).
          - Theme: Extreme celebration, high-octane hype, and massive relief because the destination is reached, the engine is shut off, and the car is parked.
          - Vocabulary Constraints: Write and sing lyrics using authentic Malwai/Majhi regional vocabulary written in the Latin alphabet. Focus heavily on rhythmic, rhyming couplets that perfectly syncopate with the dhol. Use powerful expressions of relief and victory (e.g., "Yaara", "Gaddi khadi", "Sukoon", "Kamaal", "Balle Balle"). Avoid commercial Hindi-pop words entirely to ensure structural authenticity.`,
						},
					],
				},
			],
		});

		const options = {
			hostname: "generativelanguage.googleapis.com",
			path: `/v1beta/models/lyria-3-clip-preview:generateContent`,
			method: "POST",
			headers: {
				Authorization: `Bearer ${ACCESS_TOKEN}`,
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(payload),
			},
			timeout: 60000,
		};

		const gcpReq = https.request(options, (gcpRes) => {
			let body = "";
			gcpRes.on("data", (chunk) => (body += chunk));
			gcpRes.on("end", () => {
				try {
					const responseData = JSON.parse(body);
					if (gcpRes.statusCode !== 200) {
						console.error(`API Error (${gcpRes.statusCode}):`, responseData);
						return res.status(gcpRes.statusCode).json(responseData);
					}
					const parts = responseData?.candidates?.[0]?.content?.parts || [];
					let base64Audio = null;
					for (const part of parts) {
						if (part.inlineData && part.inlineData.data) {
							base64Audio = part.inlineData.data;
							break;
						}
					}
					if (base64Audio) {
						console.log(
							"Lyria audio stream compiled. Flushing buffer to mobile client...",
						);
						const audioBuffer = Buffer.from(base64Audio, "base64");
						res.setHeader("Content-Type", "audio/mpeg");
						return res.send(audioBuffer);
					} else {
						return res
							.status(500)
							.json({ error: "No media blocks inside response." });
					}
				} catch (err) {
					return res
						.status(500)
						.json({ error: "Failed parsing API body payload." });
				}
			});
		});
		gcpReq.on("error", (e) => res.status(500).json({ error: e.message }));
		gcpReq.write(payload);
		gcpReq.end();
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.listen(PORT, () => {
	console.log(`\nArchitecture cleaned and modularized!`);
	console.log(`Running locally at http://localhost:${PORT}`);
});
