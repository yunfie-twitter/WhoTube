import { parentPort, workerData } from 'node:worker_threads';
import { JSDOM } from 'jsdom';
import { Innertube } from 'youtubei.js';
import { BG, buildURL, GOOG_API_KEY } from 'bgutils-js';

// invidious-companion style PoToken Worker for Node.js
async function setup(videoId?: string, clientType = 'WEB', cookies?: string) {
  const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : 'https://www.youtube.com/',
    pretendToBeVisual: true
  });

  const { window } = dom;
  
  // Patch global for bgutils-js
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).navigator = window.navigator;
  (global as any).location = window.location;
  (global as any).Image = window.Image;
  (global as any).HTMLCanvasElement = window.HTMLCanvasElement;

  const yt = await Innertube.create({
    generate_session_locally: true,
    retrieve_player: false,
    cookie: cookies
  });

  const visitorData = yt.session.context.client.visitorData;
  if (!visitorData) throw new Error('Could not get visitor data');

  const challenge = await yt.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
  if (!challenge.bg_challenge) throw new Error('Could not get challenge');

  const interpreterUrl = challenge.bg_challenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
  const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
  const interpreterJavascript = await bgScriptResponse.text();

  if (interpreterJavascript) {
    new Function(interpreterJavascript).call(global);
  } else {
    throw new Error('Could not load VM');
  }

  const botguard = await BG.BotGuardClient.create({
    program: challenge.bg_challenge.program,
    globalName: challenge.bg_challenge.global_name,
    globalObj: global
  });

  const webPoSignalOutput: any[] = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
  const requestKey = "O43z0dpjhgX20SCx4KAo";

  const integrityTokenResponse = await fetch(buildURL("GenerateIT", true), {
    method: "POST",
    headers: {
      "content-type": "application/json+protobuf",
      "x-goog-api-key": GOOG_API_KEY,
      "x-user-agent": "grpc-web-javascript/0.1",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify([requestKey, botguardResponse]),
  });

  const integrityTokenBody = await integrityTokenResponse.json();
  const integrityToken = integrityTokenBody[0];

  const minter = await BG.WebPoMinter.create({
    integrityToken,
  }, webPoSignalOutput);

  const poToken = await minter.mintAsWebsafeString(videoId || visitorData);
  
  return {
    poToken,
    visitorData,
    ua: USER_AGENT
  };
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    try {
      const result = await setup(msg.videoId, msg.clientType, msg.cookies);
      parentPort?.postMessage({ type: 'success', data: result });
    } catch (e: any) {
      parentPort?.postMessage({ type: 'error', error: e.message });
    }
  });
}
