import type { Lang } from './types'
import { getCase } from '@/content/cases'

/**
 * THE SWAP SEAM.
 *
 * Today: returns the pre-written answer from the content file. This is deliberate —
 * the group reveal requires every player to have seen the SAME AI answer, and a live
 * model might also (correctly!) decline to hallucinate, causing the demo to no-show
 * in front of an audience.
 *
 * Tomorrow: replace the body with a real model call over a real vector store.
 * No caller changes required — which is why this is already async.
 */
export async function getAIAnswer(caseId: string, lang: Lang): Promise<string> {
  const c = getCase(caseId)
  if (!c) throw new Error(`unknown case: ${caseId}`)
  return c.aiAnswer[lang]
}
