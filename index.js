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
							text: `An upbeat, high-energy modern Punjabi Pop and Bhangra track, 128 BPM, with a total duration of 30 seconds. Crucially, there is no musical intro; the vocals must start immediately on the very first beat of the song. Driven by a groovy, bouncing dholak rhythm, a catchy repeating tumbi melody, and a clean, punchy synth bass. The vocals are a smooth but powerful male Punjabi pop voice singing with joyful relief and high energy, pacing the lyrics quickly so the entire block is fully sung before the 30 seconds conclude. The theme is pure peace and relaxation because the drive is over. Lyrics: 
          		Aha! Hunn sukoon mil gaya yaara, gaddi khadi ae bada pyaara!
          		Na koi tension na koi ror, engine band te lutt lo mauj!
          		Aithe hi beh ke thoda hassiye, sachi yaaro nazaara aa gaya!
          		Balle balle, kamaal ho gaya, parking mil gayi! `,
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
