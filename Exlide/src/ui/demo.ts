// Fixed operation script for exercising the renderer without any AI (step 2).
// Open the app with ?demo to play it. Raw objects on purpose: they go through
// the same validator as model output, including one deliberately bad op.

export const DEMO_OPERATIONS: readonly unknown[][] = [
  [{ op: 'add_slide', title: 'Why live slides?', bullets: ['Speakers rarely follow their deck'] }],
  [{ op: 'update_bullets', slide: 's1', bullets: ['Speakers rarely follow their deck', 'Prepared slides go stale'] }],
  [
    {
      op: 'update_bullets',
      slide: 's1',
      bullets: ['Speakers rarely follow their deck', 'Prepared slides go stale', 'Audiences want a visual anchor'],
    },
  ],
  [{ op: 'add_slide', title: 'How Exlide works', bullets: ['Listens to the speaker', 'Transcribes in real time'] }],
  [{ op: 'no_change' }],
  [
    { op: 'update_bullets', slide: 's2', bullets: ['Listens to the speaker', 'Transcribes in real time', 'AI edits the deck'] },
    { op: 'explode_everything' }, // invalid: dropped and logged
  ],
  [{ op: 'set_title', slide: 's2', title: 'How Exlide works under the hood' }],
  [{ op: 'add_slide', title: 'Steering notes', bullets: ['Typed hints from the speaker', 'Override the stability rule'] }],
  [{ op: 'reorder', order: ['s1', 's3', 's2'] }],
  [{ op: 'remove_slide', slide: 's3' }],
];
