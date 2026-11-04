import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import type { Explanation, Lookup } from '../src/server/schema.js';

process.env.DEMO_MODE = 'false';
const { store } = await import('../src/server/store.js');
const { lookup } = await import('../src/server/ai.js');
const { aiCacheKey } = await import('../src/server/ai-context.js');
const { cacheKey, explanationSchema } = await import('../src/server/schema.js');

test('live lexical reuse: correct changed part of speech, reuse valid facts, and reuse durable exact encounters without tokens', async () => {
  assert(process.env.OPENAI_API_KEY, 'OpenAI API key is required.');
  assert(store.pool, 'Neon database is required.');
  const owner = `lexical-check-${randomUUID()}`;
  const language = { language: 'English', translationLanguage: 'English', mode: 'guided' as const };
  const seed: Lookup = { ...language, expression: 'book', sentence: 'I read a book on the train.' };
  const seedExplanation: Explanation = {
    lemma: 'book', partOfSpeech: 'noun', meaning: 'A written work with pages that can be read.', translation: 'written work',
    grammar: 'Book is the object of read and follows the article a.',
    clue: 'Look at the action read and the article a.', question: 'What kind of thing can be read here?',
    example: 'She borrowed a book from the library.', evidence: 'The verb read describes what happens to the book.',
    alternatives: ['Book can be a verb meaning to reserve in another sentence.'],
    check: { sentence: 'She borrowed a book from the library.', question: 'What was borrowed?', answer: 'A written work.' },
  };
  const asRecord = (input: Lookup, explanation: Explanation) => ({
    ...input, explanation, sourceUrl: '', initialInterpretation: '', revisedInterpretation: '',
    assistance: [], checkResponse: '', unresolved: false,
  });
  const reuseKey = (input: Lookup, facts: Pick<Explanation, 'lemma' | 'partOfSpeech'>) => aiCacheKey('contextual_reuse', {
    lookup: cacheKey(input, ''), lemma: facts.lemma, partOfSpeech: facts.partOfSpeech,
  });
  try {
    await store.save(owner, asRecord(seed, seedExplanation));
    const changed: Lookup = { ...language, expression: 'book', sentence: 'Please book a table for dinner tonight.' };
    const corrected = await lookup(owner, changed);
    assert.equal(corrected.cached, false);
    assert.equal(corrected.source, 'ai');
    explanationSchema.parse(corrected.explanation);
    assert.equal(corrected.explanation.lemma.toLowerCase(), 'book');
    assert.match(corrected.explanation.partOfSpeech.toLowerCase(), /\bverb\b/);
    assert.doesNotMatch(corrected.explanation.partOfSpeech.toLowerCase(), /\bnoun\b/);
    const changedRaw = await store.cache<{ lexicalUpdate: Pick<Explanation, 'lemma' | 'partOfSpeech'> | null }>(owner, reuseKey(changed, seedExplanation));
    assert(changedRaw?.lexicalUpdate, 'The model must correct the noun seed for this verb context.');
    await store.save(owner, asRecord(changed, corrected.explanation));

    const sameClass: Lookup = { ...language, expression: 'book', sentence: 'We should book our flights before prices rise.' };
    const reused = await lookup(owner, sameClass);
    assert.equal(reused.cached, false);
    explanationSchema.parse(reused.explanation);
    assert.equal(reused.explanation.lemma, corrected.explanation.lemma);
    assert.equal(reused.explanation.partOfSpeech, corrected.explanation.partOfSpeech);
    const sameRaw = await store.cache<{ lexicalUpdate: Pick<Explanation, 'lemma' | 'partOfSpeech'> | null }>(owner, reuseKey(sameClass, corrected.explanation));
    assert(sameRaw, 'The contextual result must use the lexical-seed-specific cache key.');
    assert.equal(sameRaw.lexicalUpdate, null, 'Unchanged lexical facts must be reused rather than regenerated.');
    const afterLive = await store.usage(owner);
    assert.equal(afterLive.requests, 2, 'Only two live generation requests are needed.');
    assert(afterLive.inputTokens > 0 && afterLive.outputTokens > 0);
    assert.equal(afterLive.reservedTokens, 0);

    const cacheHit = await lookup(owner, { ...sameClass, mode: 'direct' });
    assert.equal(cacheHit.cached, true);
    assert.deepEqual(cacheHit.explanation, reused.explanation);
    assert.deepEqual(await store.usage(owner), afterLive, 'Cross-mode repeat must not spend allowance.');

    // Delete only this synthetic owner's cache to exercise durable encounter reuse.
    await store.pool.query('DELETE FROM cb_cache WHERE owner_id=$1', [owner]);
    const durable = await lookup(owner, { ...changed, mode: 'direct' });
    assert.equal(durable.cached, true);
    assert.deepEqual(durable.explanation, corrected.explanation);
    assert.deepEqual(await store.usage(owner), afterLive, 'An exact saved encounter must work after response-cache deletion with no new tokens.');
    console.log(JSON.stringify({
      verified: 'Changed lexical facts corrected; unchanged facts reused; durable exact context spends zero new tokens',
      requests: afterLive.requests, inputTokens: afterLive.inputTokens, outputTokens: afterLive.outputTokens,
      reservedTokens: afterLive.reservedTokens,
    }));
  } finally {
    for (const table of ['cb_settings', 'cb_encounters', 'cb_chats', 'cb_cache', 'cb_usage']) {
      await store.pool.query(`DELETE FROM ${table} WHERE owner_id=$1`, [owner]);
    }
    await store.close();
  }
});
