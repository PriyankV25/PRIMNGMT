// ==============================================================================
// PRIMNGMT: Markdown Parser & Security Sanitizer
// Standalone, dependency-free ES module for rendering Markdown safely
// ==============================================================================

/**
 * Strips raw HTML dangerous tags and escapes characters to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates that a URL uses safe protocols (http, https, mailto, or relative storage paths)
 * Strictly blocks javascript:, vbscript:, data:, and other potential XSS vectors.
 */
export function sanitizeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  // Safe protocols
  if (/^(https?:\/\/|mailto:|\/|\.\/|\.\.\/)/i.test(trimmed)) {
    return trimmed;
  }
  // Allow safe data URIs for images only (png, jpeg, gif, webp, svg)
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(trimmed)) {
    return trimmed;
  }
  return '#unsafe-url';
}

/**
 * Converts Markdown string into safe, sanitized, structured HTML
 */
export function parseMarkdown(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return '';

  // 1. Normalize line endings
  let text = markdownText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Fenced code blocks (extract before escaping to preserve code formatting)
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({
      lang: lang ? escapeHtml(lang) : '',
      code: escapeHtml(code.replace(/\n$/, ''))
    });
    return placeholder;
  });

  // 3. Inline code blocks (extract before escaping)
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(escapeHtml(code));
    return placeholder;
  });

  // 4. Escape remaining raw HTML to prevent injection
  text = escapeHtml(text);

  // 5. Images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const safeUrl = sanitizeUrl(url.trim());
    const safeAlt = escapeHtml(alt.trim()) || 'Note image';
    if (safeUrl === '#unsafe-url') {
      return `<span class="md-unsafe-media">[Blocked unsafe image]</span>`;
    }
    return `<div class="md-image-wrapper"><img src="${safeUrl}" alt="${safeAlt}" class="md-image" loading="lazy" /></div>`;
  });

  // 6. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
    const safeUrl = sanitizeUrl(url.trim());
    if (safeUrl === '#unsafe-url') {
      return `<span class="md-unsafe-link">${linkText}</span>`;
    }
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${linkText}</a>`;
  });

  // 7. Auto-link bare URLs (https://... or http://...)
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s)<>]+)/g, (match, prefix, url) => {
    const safeUrl = sanitizeUrl(url.trim());
    return `${prefix}<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${safeUrl}</a>`;
  });

  // 8. Headers (# to ######)
  text = text.replace(/^######\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>');
  text = text.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>');
  text = text.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // 9. Horizontal rules (---, ___, ***)
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr class="md-hr" />');

  // 10. Blockquotes (> ...)
  text = text.replace(/^>\s*(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');
  // Combine consecutive blockquotes
  text = text.replace(/<\/blockquote>\n<blockquote class="md-blockquote">/g, '<br/>');

  // 11. Checklists: - [ ] or - [x]
  text = text.replace(/^[-*]\s+\[([ xX])\]\s+(.+)$/gm, (match, checked, itemText) => {
    const isChecked = checked.toLowerCase() === 'x';
    return `<li class="md-checklist-item"><input type="checkbox" class="md-checkbox" ${isChecked ? 'checked' : ''} disabled /> <span class="${isChecked ? 'md-task-done' : ''}">${itemText}</span></li>`;
  });

  // 12. Bulleted lists (- item or * item)
  text = text.replace(/^[-*]\s+(?!\[[ xX]\])(.+)$/gm, '<li class="md-bullet-item">$1</li>');

  // 13. Numbered lists (1. item)
  text = text.replace(/^\d+\.\s+(.+)$/gm, '<li class="md-numbered-item">$1</li>');

  // 14. Wrap consecutive list items in <ul> or <ol>
  text = text.replace(/((?:<li class="md-checklist-item">.*?<\/li>\s*)+)/g, '<ul class="md-checklist">$1</ul>');
  text = text.replace(/((?:<li class="md-bullet-item">.*?<\/li>\s*)+)/g, '<ul class="md-bullet-list">$1</ul>');
  text = text.replace(/((?:<li class="md-numbered-item">.*?<\/li>\s*)+)/g, '<ol class="md-numbered-list">$1</ol>');

  // 15. Bold (**text** or __text__)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // 16. Italic (*text* or _text_)
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // 17. Strikethrough (~~text~~)
  text = text.replace(/~~(.+?)~~/g, '<del class="md-del">$1</del>');

  // 18. Paragraphs: split by double newlines, wrap in <p> if not already a block element
  const blockTags = /^<(h[1-6]|ul|ol|li|blockquote|hr|div|pre)/i;
  const lines = text.split(/\n\n+/);
  const formattedBlocks = lines.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (blockTags.test(trimmed)) {
      return trimmed;
    }
    // Single newlines within paragraph convert to <br/>
    return `<p class="md-p">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  });
  text = formattedBlocks.filter(Boolean).join('\n\n');

  // 19. Restore Inline Code
  inlineCodes.forEach((code, i) => {
    text = text.replace(`__INLINE_CODE_${i}__`, `<code class="md-inline-code">${code}</code>`);
  });

  // 20. Restore Code Blocks
  codeBlocks.forEach((block, i) => {
    const langAttr = block.lang ? ` data-language="${block.lang}"` : '';
    const langLabel = block.lang ? `<div class="md-code-lang">${block.lang}</div>` : '';
    text = text.replace(
      `__CODE_BLOCK_${i}__`,
      `<div class="md-code-block"${langAttr}>${langLabel}<pre><code class="md-pre-code">${block.code}</code></pre></div>`
    );
  });

  return text;
}

/**
 * Extracts clean plain-text snippet from Markdown content for card previews
 */
export function extractPlainTextPreview(markdownText, maxLength = 140) {
  if (!markdownText) return 'No additional text content.';

  let plain = markdownText
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove image syntax
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove link syntax but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers and checklists (both multiline and inline)
    .replace(/(?:^|\s)[-*]\s+\[[ xX]\]\s+/g, ' ')
    .replace(/(?:^|\s)[-*]\s+/g, ' ')
    .replace(/(?:^|\s)\d+\.\s+/g, ' ')
    // Remove bold, italic, strikethrough
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return 'No additional text content.';
  if (plain.length > maxLength) {
    return plain.slice(0, maxLength).trim() + '...';
  }
  return plain;
}
