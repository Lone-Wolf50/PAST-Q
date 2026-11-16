import { supabase } from './supabase';
import { getAiCompletion } from './ai-helper';

export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Insane';

export interface SpeedTier {
  maxMs: number;
  bonus: number;
  label: string;
}

export interface DifficultyConfig {
  difficulty: QuestionDifficulty;
  basePoints: number;
  baseTimeSeconds: number;
  fastBadgeThresholdMs: number;
  speedTiers: [SpeedTier, SpeedTier, SpeedTier];
}

export const DIFFICULTY_CONFIG_MAP: Record<QuestionDifficulty, DifficultyConfig> = {
  Easy: {
    difficulty: 'Easy',
    basePoints: 10,
    baseTimeSeconds: 30,
    fastBadgeThresholdMs: 3000,
    speedTiers: [
      { maxMs: 3000, bonus: 3, label: '≤3s' },
      { maxMs: 6000, bonus: 2, label: '≤6s' },
      { maxMs: 10000, bonus: 1, label: '≤10s' },
    ],
  },
  Medium: {
    difficulty: 'Medium',
    basePoints: 15,
    baseTimeSeconds: 45,
    fastBadgeThresholdMs: 3000,
    speedTiers: [
      { maxMs: 4000, bonus: 5, label: '≤4s' },
      { maxMs: 8000, bonus: 3, label: '≤8s' },
      { maxMs: 12000, bonus: 1, label: '≤12s' },
    ],
  },
  Hard: {
    difficulty: 'Hard',
    basePoints: 20,
    baseTimeSeconds: 60,
    fastBadgeThresholdMs: 3000,
    speedTiers: [
      { maxMs: 4000, bonus: 8, label: '≤4s' },
      { maxMs: 8000, bonus: 5, label: '≤8s' },
      { maxMs: 14000, bonus: 2, label: '≤14s' },
    ],
  },
  Insane: {
    difficulty: 'Insane',
    basePoints: 30,
    baseTimeSeconds: 75,
    fastBadgeThresholdMs: 3000,
    speedTiers: [
      { maxMs: 3000, bonus: 15, label: '≤3s' },
      { maxMs: 6000, bonus: 10, label: '≤6s' },
      { maxMs: 12000, bonus: 5, label: '≤12s' },
    ],
  },
};

export function normalizeDifficulty(raw?: string | null): QuestionDifficulty {
  const cleaned = String(raw || '').trim().toLowerCase();
  if (cleaned === 'easy') return 'Easy';
  if (cleaned === 'normal' || cleaned === 'medium') return 'Medium';
  if (cleaned === 'hard') return 'Hard';
  if (cleaned === 'insane' || cleaned === 'extreme' || cleaned === 'expert') return 'Insane';
  return 'Medium';
}

/**
 * Calculates difficulty-aware answer time and reading grace time based on the
 * word length of the question body + options so long questions never feel rushed.
 */
export function calculateQuestionTiming(
  body: string,
  options: string[],
  rawDifficulty?: string | null
): {
  difficulty: QuestionDifficulty;
  time_limit_seconds: number;
  reading_time_seconds: number;
  base_points: number;
  speed_tiers: SpeedTier[];
} {
  const difficulty = normalizeDifficulty(rawDifficulty);
  const config = DIFFICULTY_CONFIG_MAP[difficulty];

  const fullText = `${body || ''} ${(options || []).join(' ')}`.trim();
  const wordCount = fullText ? fullText.split(/\s+/).length : 0;

  // Reading grace period before the main countdown ticks:
  // 4s minimum for short questions, +1s for every 5 words over 25 words, up to 18s for long scenario questions
  const extraReadingSeconds = wordCount > 25 ? Math.ceil((wordCount - 25) / 5) : 0;
  const reading_time_seconds = Math.min(18, Math.max(4, 4 + extraReadingSeconds));

  // Extra thinking/re-reading time added to the main countdown for long questions
  const extraAnswerSeconds = wordCount > 35
    ? Math.min(35, Math.ceil((wordCount - 35) / 4 / 5) * 5)
    : 0;
  const time_limit_seconds = config.baseTimeSeconds + extraAnswerSeconds;

  return {
    difficulty,
    time_limit_seconds,
    reading_time_seconds,
    base_points: config.basePoints,
    speed_tiers: config.speedTiers,
  };
}

export interface GeneratedQuestion {
  body: string;
  category: string;
  difficulty: QuestionDifficulty;
  correct_answer: string;
  options: string[];
  time_limit_seconds: number;
}

async function resolveCourseContext(
  selectedSubjectName?: string,
  selectedPaperId?: string,
  selectedPaperTitle?: string
): Promise<{ subjectName: string; courseDisplayLabel: string; insightData: any }> {
  let insightData: any = null;
  let subjectName = selectedSubjectName || 'General Academics';

  try {
    if (selectedPaperId) {
      const { data: exactInsights } = await supabase
        .from('upsa_paper_insights')
        .select('*, upsa_papers!inner(*, upsa_subjects!inner(name))')
        .eq('paper_id', selectedPaperId);

      if (exactInsights && exactInsights.length > 0) {
        insightData = exactInsights[0];
        subjectName = insightData.upsa_papers?.upsa_subjects?.name || subjectName;
      }
    }

    if (!insightData) {
      let query = supabase
        .from('upsa_paper_insights')
        .select('*, upsa_papers!inner(*, upsa_subjects!inner(name))');

      if (selectedSubjectName) {
        query = query.eq('upsa_papers.upsa_subjects.name', selectedSubjectName);
      }

      const { data: insights, error: insightsErr } = await query;

      if (!insightsErr && insights && insights.length > 0) {
        const randomInsight = insights[Math.floor(Math.random() * insights.length)];
        insightData = randomInsight;
        subjectName = randomInsight.upsa_papers?.upsa_subjects?.name || subjectName;
      } else if (!selectedSubjectName) {
        const { data: subjects } = await supabase.from('upsa_subjects').select('name');
        if (subjects && subjects.length > 0) {
          subjectName = subjects[Math.floor(Math.random() * subjects.length)].name;
        }
      }
    }
  } catch (err) {
    console.error('⚠️ [Question Generator] Failed to fetch database data:', err);
  }

  const courseDisplayLabel = selectedPaperTitle
    ? `${selectedPaperTitle} (${subjectName})`
    : subjectName;

  return { subjectName, courseDisplayLabel, insightData };
}

/**
 * Generates a single question with Easy / Medium / Hard / Insane support and length-aware timing.
 */
export async function generateQuestion(
  selectedSubjectName?: string,
  selectedPaperId?: string,
  selectedPaperTitle?: string,
  targetDifficulty?: QuestionDifficulty
): Promise<GeneratedQuestion> {
  const { subjectName, courseDisplayLabel, insightData } = await resolveCourseContext(
    selectedSubjectName,
    selectedPaperId,
    selectedPaperTitle
  );

  const difficulties: QuestionDifficulty[] = ['Easy', 'Medium', 'Hard', 'Insane'];
  const chosenDifficulty =
    targetDifficulty || difficulties[Math.floor(Math.random() * difficulties.length)];

  const systemPrompt = `You are an expert university academic examiner. You output strictly valid JSON conforming to the requested schema.`;
  const userPrompt = `
    Based on the course "${courseDisplayLabel}"${insightData ? ` and these paper insights:
    - Topics: ${JSON.stringify(insightData.topics)}
    - Summary: ${insightData.summary}
    - Hardest Question details: ${insightData.hardest_question}` : ''},
    
    Generate a single, unique multiple-choice question (MCQ) at "${chosenDifficulty}" difficulty:
    - "Easy": Core foundational concept or direct application.
    - "Medium": Practical scenario requiring solid comprehension.
    - "Hard": Multi-step analytical scenario requiring deeper evaluation.
    - "Insane": High-stakes exam mastery challenge with nuanced distractors and complex application.
    
    Return your response in strictly valid JSON format with these exact keys:
    {
      "body": "The question text.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "difficulty": "${chosenDifficulty}"
    }
    
    Do not include markdown backticks or any other text outside the JSON object.
  `.trim();

  let responseText: string | null = null;
  try {
    responseText = await getAiCompletion(systemPrompt, [], userPrompt);
  } catch (err: any) {
    throw new Error(`[Question Gen] All AI backends failed to generate a question. Last error: ${err.message}`);
  }

  try {
    let jsonStr = responseText.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    jsonStr = jsonStr.replace(/```json|```/g, '').trim();

    const parsed: any = JSON.parse(jsonStr);

    if (!parsed.body || !Array.isArray(parsed.options) || parsed.options.length < 2 || !parsed.correct_answer) {
      throw new Error('Invalid JSON structure returned by AI');
    }

    if (!parsed.options.includes(parsed.correct_answer)) {
      parsed.options.push(parsed.correct_answer);
    }

    const timing = calculateQuestionTiming(
      parsed.body,
      parsed.options,
      targetDifficulty ? normalizeDifficulty(targetDifficulty) : (parsed.difficulty || chosenDifficulty)
    );

    return {
      body: parsed.body,
      category: subjectName,
      difficulty: timing.difficulty,
      correct_answer: parsed.correct_answer,
      options: parsed.options,
      time_limit_seconds: timing.time_limit_seconds,
    };
  } catch (parseErr: any) {
    console.error('❌ [Question Gen] Failed to parse generated JSON:', responseText);
    throw new Error(`[Question Gen] AI response JSON parsing failed: ${parseErr.message}`);
  }
}

/**
 * Generates a full batch of questions (e.g. 5 or 10) in one AI call—either calibrated to a
 * specific difficulty level or with a progressive mix of Easy, Medium, Hard, and Insane.
 */
export async function generateQuestionsBatch(
  count: number,
  selectedSubjectName?: string,
  selectedPaperId?: string,
  selectedPaperTitle?: string,
  targetDifficulty?: QuestionDifficulty
): Promise<GeneratedQuestion[]> {
  const { subjectName, courseDisplayLabel, insightData } = await resolveCourseContext(
    selectedSubjectName,
    selectedPaperId,
    selectedPaperTitle
  );

  const safeCount = Math.min(Math.max(count, 1), 10);
  const lockedDifficulty = targetDifficulty ? normalizeDifficulty(targetDifficulty) : undefined;
  const difficultyDistribution: QuestionDifficulty[] = [];
  for (let i = 0; i < safeCount; i++) {
    if (lockedDifficulty) {
      difficultyDistribution.push(lockedDifficulty);
      continue;
    }
    const ratio = i / Math.max(safeCount - 1, 1);
    if (ratio < 0.25) difficultyDistribution.push('Easy');
    else if (ratio < 0.55) difficultyDistribution.push('Medium');
    else if (ratio < 0.8) difficultyDistribution.push('Hard');
    else difficultyDistribution.push('Insane');
  }

  const systemPrompt = `You are an expert university academic examiner. Output ONLY a valid JSON array of multiple-choice questions. No markdown fences or extra text.`;
  const userPrompt = `
    Based on the course "${courseDisplayLabel}"${insightData ? ` and these paper insights:
    - Topics: ${JSON.stringify(insightData.topics)}
    - Summary: ${insightData.summary}
    - Hardest Question details: ${insightData.hardest_question}` : ''},

    Generate exactly ${safeCount} unique, non-overlapping multiple-choice questions (MCQs)${
      lockedDifficulty
        ? ` all strictly calibrated at "${lockedDifficulty}" difficulty`
        : ` following this difficulty progression: ${difficultyDistribution.join(', ')}`
    }.
    - "Easy": Clear foundational concept or definition.
    - "Medium": Practical application or scenario question.
    - "Hard": Analytical multi-factor problem.
    - "Insane": Advanced exam-mastery challenge requiring sharp critical thinking.

    Rules:
    - Each object in the JSON array MUST have:
      - "body": string (the question prompt)
      - "options": array of exactly 4 strings
      - "correct_answer": string (must match one of the 4 options EXACTLY)
      - "difficulty": one of "Easy", "Medium", "Hard", "Insane"${lockedDifficulty ? ` (use "${lockedDifficulty}" for every item)` : ''}
    - Return ONLY a valid JSON array: [{"body":"...","options":["A","B","C","D"],"correct_answer":"A","difficulty":"${lockedDifficulty || 'Easy'}"}, ...]
  `.trim();

  const rawReply = await getAiCompletion(systemPrompt, [], userPrompt);

  let jsonStr = rawReply.trim().replace(/```json|```/g, '').trim();
  const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  const parsedList = JSON.parse(jsonStr);
  if (!Array.isArray(parsedList) || parsedList.length === 0) {
    throw new Error('Batch AI generation did not return a valid array');
  }

  const validQuestions: GeneratedQuestion[] = [];
  for (let i = 0; i < parsedList.length; i++) {
    const q = parsedList[i];
    if (!q?.body || !Array.isArray(q?.options) || q.options.length < 2 || !q?.correct_answer) {
      continue;
    }
    const opts = [...q.options];
    if (!opts.includes(q.correct_answer)) {
      opts[opts.length - 1] = q.correct_answer;
    }
    const fallbackDiff = difficultyDistribution[i] || 'Medium';
    const timing = calculateQuestionTiming(q.body, opts, lockedDifficulty || q.difficulty || fallbackDiff);
    validQuestions.push({
      body: String(q.body).trim(),
      category: subjectName,
      difficulty: timing.difficulty,
      correct_answer: String(q.correct_answer),
      options: opts,
      time_limit_seconds: timing.time_limit_seconds,
    });
  }

  if (validQuestions.length === 0) {
    throw new Error('Batch AI generation produced 0 valid questions');
  }

  return validQuestions;
}
