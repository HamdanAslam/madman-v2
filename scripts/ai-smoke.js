import { addMessage, getConversation, getMentionMap } from '../src/app/utils/ai/memory.js';
import { splitMessage, safeReply } from '../src/app/utils/ai/safeReply.js';

// Simulate conversation
addMessage('g1', 'c1', 'user', 'Hello there!', '1001', 'Alex');
addMessage('g1', 'c1', 'user', 'Hey Alex, can you help?', '1002', 'Sam');
addMessage('g1', 'c1', 'assistant', 'Sure, what do you need?', '', 'Assistant');

console.log('Conversation for API:', getConversation('g1', 'c1'));
console.log('Mention map:', getMentionMap('g1', 'c1'));

const longText = 'Line1\n\n' + 'A'.repeat(5000) + '\n\n```js\nconsole.log("ok")\n```';
const chunks = splitMessage(longText, 2000);
console.log('Chunks count:', chunks.length);

// test safeReply using a fake send function
(async () => {
  try {
    await safeReply(
      async (content, options) => {
        console.log('SEND CHUNK:', content.slice(0, 60), '... options:', options || {});
      },
      'Hello <@1001>, here is some code:\n```js\nconsole.log("hi")\n```',
      ['1001'],
    );
    console.log('safeReply OK');
  } catch (err) {
    console.error('safeReply failed', err);
  }
})();
