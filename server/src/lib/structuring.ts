import { GoogleGenAI } from '@google/genai';

export interface OCRBlock {
  text: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  confidence: number;
  isTable?: boolean;
}

export interface OCRPage {
  pageNumber: number;
  width: number;
  height: number;
  blocks: OCRBlock[];
}

export interface SubPart {
  label: string;
  text: string;
  marks: number | null;
  sub_parts?: SubPart[];
}

export interface Question {
  question_no: number;
  body: string;
  marks: number | null;
  sub_parts: SubPart[];
}

export interface StructuringResult {
  questions: Question[];
  ai_fallback_used: boolean;
}

// Helper to extract and strip marks (e.g. "(5 marks)", "[6 Marks]", or simply "(5)", "[6]" at the end)
function extractAndStripMarks(text: string): { text: string; marks: number | null } {
  const regex = /(?:Marks?\s*:\s*(\d+))|(?:\((\d+)\s*marks?\))|(?:\[(\d+)\s*marks?\])|(?:\((\d+)\)\s*$)|(?:\[(\d+)\]\s*$)/i;
  const match = text.match(regex);
  if (match) {
    const val = match[1] || match[2] || match[3] || match[4] || match[5];
    const cleanText = text.replace(regex, '').trim();
    return { text: cleanText, marks: parseInt(val, 10) || null };
  }
  return { text, marks: null };
}

// Strip question/part prefixes to avoid duplicating labels in body text
function stripLevel1Prefix(text: string): string {
  return text.replace(/^(?:Question|Q\.?)\s*\d+\s*[-:.]*\s*/i, '').trim();
}

function stripLevel2Prefix(text: string, isParen: boolean): string {
  if (isParen) {
    return text.replace(/^\(([a-zA-Z])\)\s*/, '').trim();
  }
  return text.replace(/^([a-zA-Z])\.\s*/, '').trim();
}

function stripLevel3Prefix(text: string): string {
  return text.replace(/^\(([ivxIVX]+)\)\s*/, '').replace(/^([ivxIVX]+)\.\s*/, '').trim();
}

// Call AI fallback for orphaned blocks with > 15 words
async function callAIForOrphanedBlock(text: string, apiKey: string): Promise<Question | null> {
  try {
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are a professional exam paper parser. We found an orphaned block of text before any Question heading was matched.
      Analyze this text: "${text}".
      
      If this text contains an actual exam question that students need to answer, parse it into this JSON structure:
      {
        "question_no": number, // determine the question number or default to 1
        "body": "text of the question",
        "marks": number | null,
        "sub_parts": []
      }
      
      If it is just administrative text, instructions, cover page, or not a question, return null.
      Return ONLY the JSON or null. Do not wrap in markdown code blocks.`,
      config: {
        responseMimeType: 'application/json'
      }
    });
    const reply = response.text?.trim();
    if (reply && reply !== 'null') {
      const parsed = JSON.parse(reply.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim());
      if (parsed && typeof parsed === 'object' && parsed.body) {
        return {
          question_no: Number(parsed.question_no) || 1,
          body: parsed.body,
          marks: parsed.marks !== undefined && parsed.marks !== null ? Number(parsed.marks) : null,
          sub_parts: Array.isArray(parsed.sub_parts) ? parsed.sub_parts : []
        };
      }
    }
  } catch (err: any) {
    console.warn('[Structuring AI Fallback] Orphaned block fallback failed:', err.message);
  }
  return null;
}

// Process geometry-confirmed tables into markdown using Gemini
export async function processTables(pages: OCRPage[], apiKey: string): Promise<OCRPage[]> {
  const processedPages: OCRPage[] = [];

  for (const page of pages) {
    if (!page.blocks || page.blocks.length === 0) {
      processedPages.push(page);
      continue;
    }

    const heights = page.blocks.map(b => b.boundingBox?.h || 0).filter(h => h > 0);
    heights.sort((a, b) => a - b);
    const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 20;
    const tolerance = medianHeight * 0.40;

    // Group blocks by Y band
    interface Row {
      avgY: number;
      blocks: OCRBlock[];
    }
    const rows: Row[] = [];
    for (const block of page.blocks) {
      let added = false;
      const blockY = block.boundingBox?.y ?? 0;
      for (const r of rows) {
        if (Math.abs(blockY - r.avgY) < tolerance) {
          r.blocks.push(block);
          r.avgY = r.blocks.reduce((sum, b) => sum + (b.boundingBox?.y ?? 0), 0) / r.blocks.length;
          added = true;
          break;
        }
      }
      if (!added) {
        rows.push({ avgY: blockY, blocks: [block] });
      }
    }

    for (const r of rows) {
      r.blocks.sort((a, b) => (a.boundingBox?.x ?? 0) - (b.boundingBox?.x ?? 0));
    }
    rows.sort((a, b) => a.avgY - b.avgY);

    // Identify tabular rows
    const isTabular = new Array(rows.length).fill(false);
    let lastTabularXStarts: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.blocks.length >= 3) {
        let distinctColumns = 1;
        let lastRight = (row.blocks[0].boundingBox?.x ?? 0) + (row.blocks[0].boundingBox?.w ?? 0);
        const xStarts = [row.blocks[0].boundingBox?.x ?? 0];
        for (let j = 1; j < row.blocks.length; j++) {
          const b = row.blocks[j];
          const bX = b.boundingBox?.x ?? 0;
          if (bX >= lastRight - 5) {
            distinctColumns++;
            xStarts.push(bX);
            lastRight = bX + (b.boundingBox?.w ?? 0);
          }
        }
        if (distinctColumns >= 3) {
          isTabular[i] = true;
          lastTabularXStarts = xStarts;
          continue;
        }
      }

      if (lastTabularXStarts.length >= 3 && row.blocks.length >= 2) {
        let alignCount = 0;
        for (const b of row.blocks) {
          const bX = b.boundingBox?.x ?? 0;
          const aligned = lastTabularXStarts.some(xStart => Math.abs(bX - xStart) < 30);
          if (aligned) alignCount++;
        }
        if (alignCount >= 2) {
          isTabular[i] = true;
        }
      }
    }

    // Group contiguous tabular rows
    const tableGroups: { startRow: number; endRow: number }[] = [];
    let inTable = false;
    let startIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (isTabular[i]) {
        if (!inTable) {
          inTable = true;
          startIdx = i;
        }
      } else {
        if (inTable) {
          inTable = false;
          tableGroups.push({ startRow: startIdx, endRow: i - 1 });
        }
      }
    }
    if (inTable) {
      tableGroups.push({ startRow: startIdx, endRow: rows.length - 1 });
    }

    const newBlocks: OCRBlock[] = [];
    let rowIndex = 0;

    while (rowIndex < rows.length) {
      const tg = tableGroups.find(t => rowIndex >= t.startRow && rowIndex <= t.endRow);
      if (tg) {
        const tblRows = rows.slice(tg.startRow, tg.endRow + 1);
        let rawTableText = '';
        const minX = Math.min(...tblRows.flatMap(tr => tr.blocks.map(b => b.boundingBox?.x ?? 0)));
        const minY = Math.min(...tblRows.map(tr => tr.avgY));
        const maxX = Math.max(...tblRows.flatMap(tr => tr.blocks.map(b => (b.boundingBox?.x ?? 0) + (b.boundingBox?.w ?? 0))));
        const maxY = Math.max(...tblRows.flatMap(tr => tr.blocks.map(b => (b.boundingBox?.y ?? 0) + (b.boundingBox?.h ?? 0))));

        for (const tr of tblRows) {
          rawTableText += tr.blocks.map(b => b.text).join('\t') + '\n';
        }

        let formattedMarkdown = rawTableText;
        if (apiKey) {
          try {
            console.log(`[Table Formatter] Sending geometry-confirmed table to Gemini...`);
            const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
            const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash',
              contents: `Format the following raw text representation of a data table into a clean markdown table. Preserve all numbers, characters, and headers exactly. Return ONLY the markdown table. Do not wrap in markdown code blocks.
              
              Raw Table Data:
              ${rawTableText}`
            });
            const reply = response.text?.trim();
            if (reply) {
              formattedMarkdown = reply.replace(/^```markdown\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
            }
          } catch (err: any) {
            console.warn(`[Table Formatter] Formatting failed, using raw tab-spaced text:`, err.message);
          }
        }

        newBlocks.push({
          text: formattedMarkdown,
          boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          confidence: 1.0,
          isTable: true
        });

        rowIndex = tg.endRow + 1;
      } else {
        newBlocks.push(...rows[rowIndex].blocks);
        rowIndex++;
      }
    }

    processedPages.push({
      ...page,
      blocks: newBlocks
    });
  }

  return processedPages;
}

// Main hierarchical document structuring engine
export async function structureExamPaper(
  pages: OCRPage[],
  apiKey: string
): Promise<StructuringResult> {
  const questions: Question[] = [];
  let aiFallbackUsed = false;

  let activeQ: Question | null = null;
  let activeSub: SubPart | null = null;
  let activeSubSub: SubPart | null = null;

  // Level 1 Regex (Main Question)
  const level1Regex = /^(?:Question|Q\.?)\s*(\d+)/i;
  // Level 3 Regex (Sub-sub-part)
  const level3RegexParen = /^\(([ivxIVX]+)\)/;
  const level3RegexDot = /^([ivxIVX]+)\./;

  for (const page of pages) {
    if (!page.blocks || page.blocks.length === 0) continue;

    const H = page.height || 1000;
    const heights = page.blocks.map(b => b.boundingBox?.h || 0).filter(h => h > 0);
    heights.sort((a, b) => a - b);
    const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 20;
    const tolerance = medianHeight * 0.40;

    // 1. Geometric Sorting
    const sortedBlocks = [...page.blocks].sort((a, b) => {
      const aY = a.boundingBox?.y ?? 0;
      const bY = b.boundingBox?.y ?? 0;
      const yDiff = aY - bY;
      if (Math.abs(yDiff) < tolerance) {
        return (a.boundingBox?.x ?? 0) - (b.boundingBox?.x ?? 0);
      }
      return yDiff;
    });

    // 2. Level 2 Convention Lock per page
    let level2Lock: 'paren' | 'dot' | null = null;
    for (const b of sortedBlocks) {
      if (b.isTable) continue;
      const clean = b.text.trim();
      if (/^\(([a-zA-Z])\)/.test(clean)) {
        level2Lock = 'paren';
        break;
      }
      if (/^([a-zA-Z])\./.test(clean)) {
        level2Lock = 'dot';
        break;
      }
    }

    const matchLevel2 = (text: string): { label: string; isParen: boolean } | null => {
      const clean = text.trim();
      const parenMatch = clean.match(/^\(([a-zA-Z])\)/);
      const dotMatch = clean.match(/^([a-zA-Z])\./);

      if (level2Lock === 'paren' && parenMatch) {
        return { label: parenMatch[1], isParen: true };
      }
      if (level2Lock === 'dot' && dotMatch) {
        return { label: dotMatch[1], isParen: false };
      }
      if (!level2Lock) {
        if (parenMatch) {
          level2Lock = 'paren';
          return { label: parenMatch[1], isParen: true };
        }
        if (dotMatch) {
          level2Lock = 'dot';
          return { label: dotMatch[1], isParen: false };
        }
      }
      return null;
    };

    // Process blocks on the page
    for (const block of sortedBlocks) {
      const bY = block.boundingBox?.y ?? 0;
      const bH = block.boundingBox?.h ?? 0;

      // 3. Normalize & Clean Text
      let rawText = block.text.trim();

      // Check structural matches before applying header/footer exclusion
      const isL1 = level1Regex.test(rawText);
      const isL2 = matchLevel2(rawText);
      const isL3 = rawText.match(level3RegexParen) || rawText.match(level3RegexDot);
      const isStructural = isL1 || !!isL2 || !!isL3;

      // Geometric Filter: drop header/footer unless it's structural
      const isTop10 = (bY + bH) < (0.10 * H);
      const isBottom10 = bY > (0.90 * H);
      if ((isTop10 || isBottom10) && !isStructural && !block.isTable) {
        // Skip header/footer noise
        continue;
      }

      // Marks extraction and stripping
      let { text: cleanText, marks } = extractAndStripMarks(rawText);

      // Handle table blocks: append to active deepest open context without resetting context pointers
      if (block.isTable) {
        if (cleanText) {
          if (activeSubSub) {
            activeSubSub.text += '\n\n' + cleanText;
          } else if (activeSub) {
            activeSub.text += '\n\n' + cleanText;
          } else if (activeQ) {
            activeQ.body += '\n\n' + cleanText;
          } else {
            // Orphaned table with no active context
            const wordCount = cleanText.split(/\s+/).length;
            if (wordCount > 15 && apiKey) {
              const parsedQ = await callAIForOrphanedBlock(cleanText, apiKey);
              if (parsedQ) {
                questions.push(parsedQ);
                activeQ = parsedQ;
                activeSub = null;
                activeSubSub = null;
                aiFallbackUsed = true;
              }
            }
          }
        }
        continue;
      }

      // 4. Tree Construction & Nesting Reset
      if (isL1) {
        // Reset pointers
        activeSub = null;
        activeSubSub = null;

        const match = cleanText.match(level1Regex);
        const qNo = match ? parseInt(match[1], 10) : (questions.length + 1);
        const bodyText = stripLevel1Prefix(cleanText);

        activeQ = {
          question_no: qNo,
          body: bodyText,
          marks,
          sub_parts: []
        };
        questions.push(activeQ);

      } else if (isL2) {
        // Reset pointer
        activeSubSub = null;

        const bodyText = stripLevel2Prefix(cleanText, isL2.isParen);
        if (activeQ) {
          activeSub = {
            label: isL2.label,
            text: bodyText,
            marks,
            sub_parts: []
          };
          activeQ.sub_parts.push(activeSub);
        } else {
          // Orphaned sub-part before any main question
          const wordCount = cleanText.split(/\s+/).length;
          if (wordCount > 15 && apiKey) {
            const parsedQ = await callAIForOrphanedBlock(cleanText, apiKey);
            if (parsedQ) {
              questions.push(parsedQ);
              activeQ = parsedQ;
              activeSub = null;
              activeSubSub = null;
              aiFallbackUsed = true;
            }
          }
        }

      } else if (isL3) {
        const bodyText = stripLevel3Prefix(cleanText);
        const label = isL3[1];
        if (activeSub) {
          activeSubSub = {
            label,
            text: bodyText,
            marks,
            sub_parts: []
          };
          if (!activeSub.sub_parts) activeSub.sub_parts = [];
          activeSub.sub_parts.push(activeSubSub);
        } else {
          // Orphaned sub-sub-part
          const wordCount = cleanText.split(/\s+/).length;
          if (wordCount > 15 && apiKey) {
            const parsedQ = await callAIForOrphanedBlock(cleanText, apiKey);
            if (parsedQ) {
              questions.push(parsedQ);
              activeQ = parsedQ;
              activeSub = null;
              activeSubSub = null;
              aiFallbackUsed = true;
            }
          }
        }

      } else {
        // Unmatched Text Block: Orphaned Text Handling
        if (cleanText) {
          if (activeSubSub) {
            activeSubSub.text += (activeSubSub.text ? ' ' : '') + cleanText;
            if (marks && activeSubSub.marks === null) activeSubSub.marks = marks;
          } else if (activeSub) {
            activeSub.text += (activeSub.text ? ' ' : '') + cleanText;
            if (marks && activeSub.marks === null) activeSub.marks = marks;
          } else if (activeQ) {
            activeQ.body += (activeQ.body ? ' ' : '') + cleanText;
            if (marks && activeQ.marks === null) activeQ.marks = marks;
          } else {
            // No active context open at all
            const wordCount = cleanText.split(/\s+/).length;
            if (wordCount > 15 && apiKey) {
              const parsedQ = await callAIForOrphanedBlock(cleanText, apiKey);
              if (parsedQ) {
                questions.push(parsedQ);
                activeQ = parsedQ;
                activeSub = null;
                activeSubSub = null;
                aiFallbackUsed = true;
              }
            }
          }
        }
      }
    }
  }

  // Final cleanup of empty text or sub_parts array properties if unused
  for (const q of questions) {
    if (q.sub_parts) {
      for (const sp of q.sub_parts) {
        if (sp.sub_parts && sp.sub_parts.length === 0) {
          delete sp.sub_parts;
        }
      }
    }
  }

  return {
    questions,
    ai_fallback_used: aiFallbackUsed
  };
}
