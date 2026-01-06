// Splits long messages into Discord-safe chunks while preserving code blocks and explicit mentions.
export function splitMessage(text, maxLength = 2000) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return ['⚠️ (AI returned an empty message)'];
  }

  // Escape mass pings but keep explicit Discord mention tokens like <@123> and role mentions intact.
  const sanitized = text.replace(/@everyone/g, '@\u200beveryone').replace(/@here/g, '@\u200bhere');

  if (sanitized.length <= maxLength) return [sanitized];

  const chunks = [];
  // We'll split by paragraphs but try to keep code blocks intact.
  const parts = sanitized.split(/\n\n+/);

  let current = '';
  for (const part of parts) {
    const addition = (current ? '\n\n' : '') + part;
    if (addition.length + current.length <= maxLength) {
      current += addition;
    } else {
      if (current) chunks.push(current);
      if (part.length <= maxLength) {
        current = part;
      } else {
        // Part is too big - fallback to line-based split which also preserves inline code blocks
        const lines = part.split('\n');
        let small = '';
        for (const line of lines) {
          const sep = small ? '\n' : '';
          if (small.length + sep.length + line.length <= maxLength) {
            small += sep + line;
          } else {
            if (small) chunks.push(small);
            if (line.length > maxLength) {
              // extremely long single line: hard-split
              let remaining = line;
              while (remaining.length > 0) {
                chunks.push(remaining.slice(0, maxLength));
                remaining = remaining.slice(maxLength);
              }
              small = '';
            } else {
              small = line;
            }
          }
        }
        if (small) current = small;
        else current = '';
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : ['⚠️ (AI returned an empty message)'];
}

// sendFn should accept (content, options) where options can include allowedMentions.
export async function safeReply(sendFn, text, allowedMentions = []) {
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    try {
      const options = {};
      if (allowedMentions && allowedMentions.length > 0) {
        options.allowedMentions = { users: allowedMentions };
      }
      await sendFn(chunks[i], options);
    } catch (error) {
      console.error(`Failed to send chunk ${i + 1}/${chunks.length}:`, error);
      throw error;
    }
  }
}
