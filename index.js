const fs = require("fs");
const https = require("https");
const { GoogleAuth } = require("google-auth-library");

const KEY_PATH = "./lyria.json";

if (!fs.existsSync(KEY_PATH)) {
	console.error("❌ Error: lyria.json not found in this directory!");
	process.exit(1);
}

async function runTest() {
	console.log(`🚀 Authenticating using ${KEY_PATH}...`);
	const auth = new GoogleAuth({
		keyFile: KEY_PATH,
		scopes: "https://www.googleapis.com/auth/generative-language",
	});

	const client = await auth.getClient();
	const tokenResponse = await client.getAccessToken();
	const ACCESS_TOKEN = tokenResponse.token;

	console.log("🔒 Access Token secured.");
	console.log("🎵 Submitting track request to global Lyria 3 Clip Engine...");

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

	const req = https.request(options, (res) => {
		let body = "";
		res.on("data", (chunk) => (body += chunk));
		res.on("end", () => {
			try {
				const responseData = JSON.parse(body);
				if (res.statusCode !== 200) {
					console.error(`❌ API Error (${res.statusCode}):`, responseData);
					return;
				}
				const parts = responseData?.candidates?.[0]?.content?.parts || [];
				let audioSaved = false;
				for (const part of parts) {
					if (part.inlineData && part.inlineData.data) {
						const base64Audio = part.inlineData.data;
						const audioBuffer = Buffer.from(base64Audio, "base64");
						fs.writeFileSync("./parking-song.mp3", audioBuffer);
						console.log(
							"✅ Success! 'parking-song.mp3' has been downloaded to your project directory.",
						);
						audioSaved = true;
						break;
					}
				}
				if (!audioSaved) {
					console.error(
						"❌ Error: Response parsed, but no valid audio bytes found in parts.",
						JSON.stringify(responseData, null, 2),
					);
				}
			} catch (err) {
				console.error("❌ Failed to parse response data layout:", err);
				console.log("Raw Output Buffer:", body);
			}
		});
	});

	req.on("error", (e) => {
		console.error(`❌ Connection failed: ${e.message}`);
	});

	req.write(payload);
	req.end();
}

runTest().catch(console.error);
