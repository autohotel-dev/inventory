const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/hackm/.gemini/antigravity/brain/336b0aaf-a230-4a17-abc2-8e187581f760/conversation.json');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let rawData = "";
  for await (const line of rl) {
    rawData += line;
  }
  
  const data = JSON.parse(rawData);
  let targetIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].role === 'user' && JSON.stringify(data[i]).includes('walkthrough_add_service_button.md')) {
      targetIndex = i;
    }
  }
  
  if (targetIndex === -1) {
    console.log("Boundary message not found");
    return;
  }

  let hookCode = null;
  let modalCode = null;
  
  for (let i = targetIndex; i >= 0; i--) {
      const step = data[i];
      if (step.role === 'tool' && step.name === 'default_api' && step.response && step.response.output) {
          const text = typeof step.response.output === 'string' ? step.response.output : JSON.stringify(step.response.output);
          
          if (!hookCode && text.includes('export function useGranularPayment(')) {
              hookCode = text;
          }
          if (!modalCode && text.includes('export function GranularPaymentModal(')) {
              modalCode = text;
          }
          
          if (hookCode && modalCode) break;
      }
  }

  if (hookCode) fs.writeFileSync('c:/desarrollos/luxor/original_hook.ts', hookCode);
  if (modalCode) fs.writeFileSync('c:/desarrollos/luxor/original_modal.tsx', modalCode);

  console.log("Extraction complete.");
}

processLineByLine();
