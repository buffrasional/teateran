import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function analyzeImage(imagePath, prompt) {
  const zai = await ZAI.create();
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      }
    ],
    thinking: { type: 'disabled' }
  });

  return response.choices[0]?.message?.content;
}

async function main() {
  console.log("=== IMAGE 1: QR Ticket Page ===");
  try {
    const result1 = await analyzeImage(
      "/home/z/my-project/upload/pasted_image_1775140862026.png",
      "Describe in detail ALL text, numbers, fields, labels, and layout visible on this screenshot. List every single piece of text you can read verbatim. Focus on ticket information, QR code details, pricing, order numbers, dates, times, and any other visible data."
    );
    console.log(result1);
  } catch (e) {
    console.error("Error on image 1:", e.message);
  }

  console.log("\n\n=== IMAGE 2: Checkout/Payment Page ===");
  try {
    const result2 = await analyzeImage(
      "/home/z/my-project/upload/pasted_image_1775142382724.png",
      "Describe in detail ALL text, numbers, fields, labels, buttons, and layout visible on this screenshot. List every single piece of text and number you can read verbatim. Focus on item names, prices, discount codes, discount amounts, subtotal, tax, total calculations, and identify what calculation seems wrong or inconsistent."
    );
    console.log(result2);
  } catch (e) {
    console.error("Error on image 2:", e.message);
  }
}

main();
