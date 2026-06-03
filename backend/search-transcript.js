const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:/Users/manso/.gemini/antigravity/brain/dad2d881-48c5-4a96-95b4-1b0718777bd6/.system_generated/logs/transcript.jsonl');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

console.log('Searching transcript.jsonl for keywords:');
rl.on('line', (line) => {
  if (line.toLowerCase().includes('react native') || line.toLowerCase().includes('flutter') || line.toLowerCase().includes('apk') || line.toLowerCase().includes('app') || line.toLowerCase().includes('mobile')) {
    // Only print if the line contains user messages or planner output that is relevant
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' || (obj.type === 'PLANNER_RESPONSE' && obj.content && (obj.content.includes('app') || obj.content.includes('mobile')))) {
        console.log(`[Step ${obj.step_index}] ${obj.type}: ${obj.content ? obj.content.substring(0, 300) : ''}`);
      }
    } catch (e) {}
  }
});
